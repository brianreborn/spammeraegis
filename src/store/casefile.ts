import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Account, Alert, AltCluster, Casefile, QueueStatus } from "@/lib/altbreak/types";
import { emptyCasefile } from "@/lib/altbreak/types";
import { detectAlts, applyBatchFlags } from "@/lib/altbreak/detect";
import { buildDemoCase } from "@/lib/altbreak/demo";
import { parseArchiveBuffer, parseLooseFile } from "@/lib/altbreak/parse-zip";
import { parseCasefileJson } from "@/lib/altbreak/casefile-json";
import { accountFromProfile, type LiveHit } from "@/lib/altbreak/live";
import { findWatchers } from "@/lib/altbreak/watchers";
import { uid } from "@/lib/utils";

type View = "desk" | "import" | "graph" | "alts" | "queue" | "log" | "export" | "capture" | "crawl" | "about";

type Store = {
  cf: Casefile;
  view: View;
  selectedId?: string;
  clusters: AltCluster[];
  query: string;
  setView: (view: View) => void;
  setQuery: (query: string) => void;
  select: (id?: string) => void;
  loadDemo: () => void;
  reset: () => void;
  importFiles: (files: FileList | File[]) => Promise<string[]>;
  captureAccount: (input: { username?: string; id?: string; displayName?: string; bio?: string; queue: boolean }) => void;
  ingestLive: (hits: LiveHit[], opts?: { queueOdd?: boolean }) => void;
  flagCluster: (cluster: AltCluster) => void;
  flagAllClusters: () => void;
  queueAccount: (accountId: string, reason: string) => void;
  queueWatchers: () => number;
  setQueueStatus: (id: string, status: QueueStatus) => void;
  markAlertRead: (id: string) => void;
  setNote: (accountId: string, note: string) => void;
  setName: (name: string) => void;
  restoreCase: (cf: Casefile) => void;
  refreshDetect: () => void;
};

function mergeAccount(into: Account, extra: Account): Account {
  return {
    ...into,
    username: extra.username ?? into.username,
    displayName: extra.displayName ?? into.displayName,
    bio: extra.bio ?? into.bio,
    createdAt: extra.createdAt ?? into.createdAt,
    followersCount: extra.followersCount ?? into.followersCount,
    followingCount: extra.followingCount ?? into.followingCount,
    tweetsCount: extra.tweetsCount ?? into.tweetsCount,
    likesCount: extra.likesCount ?? into.likesCount,
    protected: extra.protected ?? into.protected,
    verified: extra.verified ?? into.verified,
    avatarUrl: extra.avatarUrl ?? into.avatarUrl,
    website: extra.website ?? into.website,
    location: extra.location ?? into.location,
    sources: Array.from(new Set([...into.sources, ...extra.sources])),
    blockedIn: Array.from(new Set([...into.blockedIn, ...extra.blockedIn])),
    mutedIn: Array.from(new Set([...into.mutedIn, ...extra.mutedIn])),
    capturedAt: extra.capturedAt ?? into.capturedAt,
  };
}

function withDetect(cf: Casefile): Pick<Store, "cf" | "clusters"> {
  const { clusters, alerts } = detectAlts(cf);
  const priorRead = new Set(cf.alerts.filter((a) => a.read).map((a) => a.id));
  const mergedAlerts: Alert[] = alerts.map((a) => ({ ...a, read: priorRead.has(a.id) }));
  return { cf: { ...cf, alerts: mergedAlerts }, clusters };
}

export const useCasefile = create<Store>()(
  persist(
    (set, get) => ({
      ...withDetect(buildDemoCase()),
      view: "desk" as const,
      query: "",
      setView: (view) => set({ view }),
      setQuery: (query) => set({ query }),
      select: (id) => set({ selectedId: id }),
      loadDemo: () => set({ ...withDetect(buildDemoCase()), selectedId: undefined, view: "desk" }),
      reset: () => set({ cf: emptyCasefile(), clusters: [], selectedId: undefined, view: "import" }),
      refreshDetect: () => set(withDetect(get().cf)),
      importFiles: async (files) => {
        const list = [...files];
        const warnings: string[] = [];
        let cf = get().cf.isDemo ? emptyCasefile() : structuredClone(get().cf);
        if (get().cf.isDemo) cf.name = "Imported case";
        for (const file of list) {
          try {
            if (file.name.toLowerCase().endsWith(".json")) {
              const text = await file.text();
              try {
                const restored = parseCasefileJson(text);
                cf = restored;
                cf.logs.unshift({
                  id: uid("log"),
                  at: new Date().toISOString(),
                  kind: "import",
                  message: `Restored case “${restored.name}” from ${file.name}.`,
                });
                continue;
              } catch {
                const result = await parseLooseFile(text, file.name);
                warnings.push(...result.warnings);
                cf.archives.push(result.archive);
                for (const acc of result.accounts) {
                  cf.accounts[acc.id] = cf.accounts[acc.id] ? mergeAccount(cf.accounts[acc.id]!, acc) : acc;
                }
                cf.relations.push(...result.relations);
                cf.logs.unshift({
                  id: uid("log"),
                  at: new Date().toISOString(),
                  kind: "import",
                  archiveId: result.archive.id,
                  message: `Imported ${file.name} · ${result.accounts.length} accounts · ${result.relations.length} edges.`,
                });
                continue;
              }
            }
            const result = file.name.toLowerCase().endsWith(".zip")
              ? await parseArchiveBuffer(await file.arrayBuffer(), file.name)
              : await parseLooseFile(await file.text(), file.name);
            warnings.push(...result.warnings);
            cf.archives.push(result.archive);
            for (const acc of result.accounts) {
              cf.accounts[acc.id] = cf.accounts[acc.id] ? mergeAccount(cf.accounts[acc.id]!, acc) : acc;
            }
            cf.relations.push(...result.relations);
            cf.logs.unshift({
              id: uid("log"),
              at: new Date().toISOString(),
              kind: "import",
              archiveId: result.archive.id,
              message: `Imported ${file.name} · ${result.accounts.length} accounts · ${result.relations.length} edges.`,
            });
            if (!cf.name || cf.name === "Untitled case") cf.name = file.name.replace(/\.[^.]+$/, "");
          } catch (err) {
            warnings.push(`${file.name}: ${err instanceof Error ? err.message : "import failed"}`);
          }
        }
        if (cf.isDemo && Object.keys(cf.accounts).length) cf.isDemo = false;
        set({ ...withDetect(cf), view: "desk" });
        return warnings;
      },
      captureAccount: (input) => {
        const at = new Date().toISOString();
        const cf = structuredClone(get().cf);
        const id = input.id || `cap_${(input.username ?? "unknown").toLowerCase()}`;
        const extra: Account = {
          id,
          username: input.username,
          displayName: input.displayName,
          bio: input.bio,
          sources: ["capture"],
          blockedIn: [],
          mutedIn: [],
          capturedAt: at,
        };
        cf.accounts[id] = cf.accounts[id] ? mergeAccount(cf.accounts[id]!, extra) : extra;
        if (input.queue && !cf.queue.some((q) => q.accountId === id && q.status !== "done")) {
          cf.queue.unshift({
            id: uid("q"),
            accountId: id,
            reason: "Captured from field",
            status: "open",
            addedAt: at,
          });
        }
        cf.logs.unshift({
          id: uid("log"),
          at,
          kind: "capture",
          accountId: id,
          message: `Captured ${input.username ?? id}.`,
        });
        if (cf.isDemo) cf.isDemo = false;
        set({ ...withDetect(cf), selectedId: id, view: input.queue ? "queue" : "desk" });
      },
      ingestLive: (hits, opts) => {
        const at = new Date().toISOString();
        const cf = structuredClone(get().cf);
        const queueOdd = opts?.queueOdd !== false;
        const okHits = hits.filter((h) => h.ok && h.profile);
        if (!okHits.length) return;
        let ingested = 0;
        const crawlId = uid("crawl");
        cf.archives.push({
          id: crawlId,
          filename: `live-check-${at.slice(0, 10)}`,
          date: at.slice(0, 10),
          importedAt: at,
          counts: { blocks: 0, mutes: 0, followers: 0, following: 0, tweets: 0, likes: 0, mentions: 0 },
          kind: "crawl",
        });
        for (const hit of okHits) {
          if (!hit.profile) continue;
          const next = accountFromProfile(hit.profile, "crawl", at);
          const prev = cf.accounts[next.id];
          cf.accounts[next.id] = prev ? mergeAccount(prev, next) : next;
          ingested += 1;
          const arch = cf.archives[cf.archives.length - 1];
          if (arch) {
            arch.counts.following += hit.following?.length ?? 0;
            arch.counts.tweets += hit.statuses?.length ?? 0;
            arch.username = arch.username ?? hit.profile.username;
          }
          for (const n of hit.following ?? []) {
            const neighbor = cf.accounts[n.id];
            const extra: Account = {
              id: n.id,
              username: n.username,
              displayName: n.displayName,
              bio: n.bio,
              followersCount: n.followersCount,
              followingCount: n.followingCount,
              sources: ["crawl"],
              blockedIn: [],
              mutedIn: [],
            };
            cf.accounts[n.id] = neighbor ? mergeAccount(neighbor, extra) : extra;
            cf.relations.push({
              id: uid("rel"),
              source: next.id,
              target: n.id,
              type: "follow",
              archiveId: crawlId,
            });
          }
          if (queueOdd && hit.score >= 40) {
            if (!cf.queue.some((q) => q.accountId === next.id && q.status !== "done")) {
              cf.queue.unshift({
                id: uid("q"),
                accountId: next.id,
                reason: `Live-check score ${hit.score} · ${hit.flags
                  .slice(0, 3)
                  .map((f) => f.label)
                  .join(", ")}`,
                status: "open",
                addedAt: at,
              });
            }
          }
          if (hit.score >= 55) {
            cf.alerts.unshift({
              id: uid("alert"),
              at,
              title: `Odd live profile @${hit.profile.username}`,
              detail: hit.flags
                .slice(0, 3)
                .map((f) => f.detail)
                .join(" · "),
              accountIds: [next.id, ...hit.nearIds],
              severity: hit.score >= 70 ? "high" : "medium",
              read: false,
            });
          }
        }
        cf.logs.unshift({
          id: uid("log"),
          at,
          kind: "crawl",
          message: `Live-checked ${hits.length} · ingested ${ingested} into the case.`,
        });
        if (cf.isDemo && ingested) cf.isDemo = false;
        set({ ...withDetect(cf), view: queueOdd ? "queue" : "desk" });
      },
      flagCluster: (cluster) => {
        const cf = applyBatchFlags(structuredClone(get().cf), [cluster]);
        set({ ...withDetect(cf), view: "queue" });
      },
      flagAllClusters: () => {
        const cf = applyBatchFlags(structuredClone(get().cf), get().clusters);
        set({ ...withDetect(cf), view: "queue" });
      },
      queueAccount: (accountId, reason) => {
        const cf = structuredClone(get().cf);
        if (!cf.queue.some((q) => q.accountId === accountId && q.status !== "done")) {
          cf.queue.unshift({
            id: uid("q"),
            accountId,
            reason,
            status: "open",
            addedAt: new Date().toISOString(),
          });
        }
        set({ cf, view: "queue", selectedId: accountId });
      },
      queueWatchers: () => {
        const cf = structuredClone(get().cf);
        const watchers = findWatchers(cf);
        const at = new Date().toISOString();
        let n = 0;
        for (const w of watchers) {
          if (cf.queue.some((q) => q.accountId === w.accountId && q.status !== "done")) continue;
          cf.queue.unshift({
            id: uid("q"),
            accountId: w.accountId,
            reason: w.reasons[0] ?? "Still watching",
            status: "open",
            addedAt: at,
          });
          n += 1;
        }
        if (n) {
          cf.logs.unshift({
            id: uid("log"),
            at,
            kind: "queue",
            message: `Queued ${n} watcher(s) who will not stop watching.`,
          });
        }
        set({ cf, view: "queue" });
        return n;
      },
      setQueueStatus: (id, status) => {
        const cf = structuredClone(get().cf);
        const item = cf.queue.find((q) => q.id === id);
        if (item) item.status = status;
        set({ cf });
      },
      markAlertRead: (id) => {
        const cf = structuredClone(get().cf);
        const alert = cf.alerts.find((a) => a.id === id);
        if (alert) alert.read = true;
        set({ cf });
      },
      setNote: (accountId, note) => {
        const cf = structuredClone(get().cf);
        if (note.trim()) cf.notes[accountId] = note;
        else delete cf.notes[accountId];
        set({ cf });
      },
      setName: (name) => {
        const cf = structuredClone(get().cf);
        cf.name = name.trim() || cf.name;
        set({ cf });
      },
      restoreCase: (next) => {
        set({ ...withDetect({ ...next, isDemo: false }), selectedId: undefined, view: "desk" });
      },
    }),
    {
      name: "spammeraegis-casefile",
      storage: createJSONStorage(() => {
        try {
          const next = localStorage.getItem("spammeraegis-casefile");
          const prev = localStorage.getItem("altbreak-casefile");
          if (!next && prev) localStorage.setItem("spammeraegis-casefile", prev);
        } catch {
          /* private mode */
        }
        return localStorage;
      }),
      onRehydrateStorage: () => (state) => {
        if (state) Object.assign(state, withDetect(state.cf));
      },
    },
  ),
);
 