import { useMemo, useState } from "react";
import { Radar, ScanSearch, ShieldAlert, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { crawlProfiles } from "@/lib/altbreak/crawl.functions";
import {
  hitFromProfile,
  parseHandles,
  profileFromAccount,
  type LiveHit,
} from "@/lib/altbreak/live";
import { formatInt, formatWhen, handleOf, xIntentUserUrl } from "@/lib/utils";
import { downloadFieldKitXpi } from "@/lib/altbreak/field-kit";
import { useCasefile } from "@/store/casefile";
import { toast } from "sonner";

export function CrawlView() {
  const cf = useCasefile((s) => s.cf);
  const ingestLive = useCasefile((s) => s.ingestLive);
  const [text, setText] = useState("grok");
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<LiveHit[]>([]);

  const blockedHandles = useMemo(
    () =>
      Object.values(cf.accounts)
        .filter((a) => a.blockedIn.length && a.username)
        .slice(0, 8)
        .map((a) => a.username!)
        .join("\n"),
    [cf.accounts],
  );

  async function runLive() {
    const handles = parseHandles(text);
    if (!handles.length) {
      toast.error("Paste @handles or profile URLs first");
      return;
    }
    setBusy(true);
    try {
      const { results } = await crawlProfiles({ data: { handles: handles.slice(0, 8), deep } });
      const next: LiveHit[] = results.map((r) => {
        if (!r.ok || !r.profile) {
          return {
            query: r.query,
            ok: false,
            error: r.error ?? "No profile",
            source: "live" as const,
            flags: [],
            score: 0,
            nearIds: [],
          };
        }
        return hitFromProfile(r.query, r.profile, useCasefile.getState().cf, "live", {
          following: r.following,
          statuses: r.statuses,
        });
      });
      setHits(next);
      const odd = next.filter((h) => h.ok && h.score >= 40).length;
      toast.success(`Looked up ${next.length} · ${odd} look odd vs this case`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Live lookup failed");
    } finally {
      setBusy(false);
    }
  }

  function runLocalPass() {
    const wanted = parseHandles(text);
    const pool = Object.values(cf.accounts).filter((a) => {
      if (!a.username) return false;
      if (wanted.length) return wanted.some((h) => h.replace(/^id:/, "") === a.username?.toLowerCase() || h === a.id);
      return a.blockedIn.length > 0 || Boolean(a.capturedAt);
    });
    const next = pool.slice(0, 24).map((a) => hitFromProfile(a.username ?? a.id, profileFromAccount(a), cf, "local"));
    next.sort((a, b) => b.score - a.score);
    setHits(next);
    toast.success(`Oddity pass on ${next.length} loaded accounts (no network)`);
  }

  async function runQueueLive() {
    const handles = cf.queue
      .filter((q) => q.status !== "done")
      .map((q) => cf.accounts[q.accountId]?.username)
      .filter((h): h is string => Boolean(h));
    if (!handles.length) {
      toast.error("Open queue has no handles to look up");
      return;
    }
    setText(handles.join("\n"));
    setBusy(true);
    try {
      const { results } = await crawlProfiles({ data: { handles: handles.slice(0, 8), deep } });
      const next: LiveHit[] = results.map((r) => {
        if (!r.ok || !r.profile) {
          return {
            query: r.query,
            ok: false,
            error: r.error ?? "No profile",
            source: "live" as const,
            flags: [],
            score: 0,
            nearIds: [],
          };
        }
        return hitFromProfile(r.query, r.profile, useCasefile.getState().cf, "live", {
          following: r.following,
          statuses: r.statuses,
        });
      });
      setHits(next);
      toast.success(`Queue live-check: ${next.length}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Queue lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExtension() {
    try {
      await downloadFieldKitXpi();
      toast.success("XPI downloaded — about:debugging → Load Temporary Add-on");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pack the add-on");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Live crawl</h1>
      <p className="max-w-2xl text-sm text-muted">
        Public profile sample against this case. No X login. Full follower dumps still come from imported NDJSON.
      </p>
      <textarea
        className="min-h-28 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={blockedHandles || "@handles, URLs, or numeric ids"}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
        Sample following / posts
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void runLive()} disabled={busy}>
          <Radar /> Live-check
        </Button>
        <Button variant="secondary" onClick={runLocalPass}>
          <ScanSearch /> Local pass
        </Button>
        <Button variant="ghost" onClick={() => void runQueueLive()} disabled={busy}>
          Queue lookup
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const odd = hits.filter((h) => h.ok && h.score >= 40);
            if (!odd.length) {
              toast.error("No odd hits to ingest");
              return;
            }
            ingestLive(odd, { queueOdd: true });
            toast.success(`Ingested ${odd.length} odd profile(s)`);
          }}
        >
          <ShieldAlert /> Ingest odd
        </Button>
      </div>
      {hits.length > 0 && (
        <ul className="flex flex-col gap-2">
          {hits.map((hit) => (
            <HitRow key={hit.query} hit={hit} />
          ))}
        </ul>
      )}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">Companion (Firefox)</h2>
        <p className="text-sm text-muted">
          Standard Firefox: download the .xpi, then about:debugging → This Firefox → Load Temporary
          Add-on → pick the file. It lasts until you restart the browser. Permanent install needs
          Mozilla signing (AMO); Release will not keep an unsigned add-on.
        </p>
        <Button variant="secondary" onClick={() => void downloadExtension()}>
          <Download /> Download .xpi
        </Button>
        <p className="text-xs text-subtle">
          Unsigned, local-only, hosts limited to x.com. Vanadium cannot install add-ons.
        </p>
      </section>
    </div>
  );
}

function HitRow({ hit }: { hit: LiveHit }) {
  const ingestLive = useCasefile((s) => s.ingestLive);
  const p = hit.profile;
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-mono text-sm">{p ? `@${p.username}` : hit.query}</div>
          <p className="text-sm text-muted">{hit.ok ? p?.bio : hit.error}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {hit.flags.slice(0, 4).map((f) => (
              <Badge key={f.code} tone={f.weight >= 28 ? "danger" : "warn"}>
                {f.label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-subtle">{hit.ok ? `score ${hit.score}` : "miss"}</span>
          {hit.ok && p && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                ingestLive([hit], { queueOdd: true });
                toast.success(`Queued @${p.username}`);
              }}
            >
              Queue
            </Button>
          )}
          {p && (
            <Button size="sm" variant="ghost" asChild>
              <a href={xIntentUserUrl(p.id)} target="_blank" rel="noreferrer">
                Open
              </a>
            </Button>
          )}
        </div>
      </div>
      {p && (
        <div className="mt-2 font-mono text-[11px] text-subtle">
          {handleOf({ id: p.id, username: p.username })} · {formatInt(p.followersCount)} followers ·{" "}
          {formatWhen(p.createdAt)}
        </div>
      )}
    </li>
  );
}
 