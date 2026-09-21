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
            if (!cf.name || cf.
... 