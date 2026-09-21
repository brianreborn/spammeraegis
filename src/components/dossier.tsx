import { useState } from "react";
import { Ban, ExternalLink, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatInt, handleOf, xIntentUserUrl, xUserUrl } from "@/lib/utils";
import { useCasefile } from "@/store/casefile";

export function Dossier({ accountId }: { accountId: string }) {
  const cf = useCasefile((s) => s.cf);
  const clusters = useCasefile((s) => s.clusters);
  const queueAccount = useCasefile((s) => s.queueAccount);
  const setNote = useCasefile((s) => s.setNote);
  const acc = cf.accounts[accountId];
  const [note, setLocal] = useState(cf.notes[accountId] ?? "");
  if (!acc) return null;

  const queued = cf.queue.some((q) => q.accountId === acc.id && q.status !== "done");
  const inCluster = clusters.find((c) => c.memberIds.includes(acc.id));

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-medium tracking-tight">{handleOf(acc)}</h2>
          {acc.displayName && acc.username && (
            <div className="text-sm text-muted">{acc.displayName}</div>
          )}
          <div className="mt-1 font-mono text-xs text-subtle">{acc.id}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {acc.username && (
            <Button size="sm" variant="secondary" asChild>
              <a href={xUserUrl(acc)} target="_blank" rel="noreferrer">
                <ExternalLink /> Profile
              </a>
            </Button>
          )}
          <Button size="sm" variant="secondary" asChild>
            <a href={xIntentUserUrl(acc.id)} target="_blank" rel="noreferrer">
              <ExternalLink /> Intent
            </a>
          </Button>
          <Button size="sm" onClick={() => queueAccount(acc.id, "Queued from dossier")} disabled={queued}>
            <Ban /> {queued ? "Queued" : "Queue"}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {acc.blockedIn.length > 0 && <Badge tone="danger">blocked ×{acc.blockedIn.length}</Badge>}
        {acc.mutedIn.length > 0 && <Badge tone="warn">muted</Badge>}
        {acc.capturedAt && <Badge>captured</Badge>}
        {inCluster && <Badge tone="warn">alt score {inCluster.score}</Badge>}
      </div>
      {acc.bio && <p className="mt-3 text-sm text-muted">{acc.bio}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-subtle sm:grid-cols-4">
        <div>
          <dt>followers</dt>
          <dd className="text-fg">{formatInt(acc.followersCount ?? 0)}</dd>
        </div>
        <div>
          <dt>following</dt>
          <dd className="text-fg">{formatInt(acc.followingCount ?? 0)}</dd>
        </div>
        <div>
          <dt>created</dt>
          <dd className="text-fg">{acc.createdAt?.slice(0, 10) ?? "—"}</dd>
        </div>
        <div>
          <dt>sources</dt>
          <dd className="truncate text-fg">{acc.sources.slice(0, 3).join(", ") || "—"}</dd>
        </div>
      </dl>
      <label className="mt-4 block text-xs text-subtle">
        <span className="inline-flex items-center gap-1">
          <StickyNote className="size-3.5" strokeWidth={1.75} /> Note
        </span>
        <textarea
          value={note}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => setNote(acc.id, note)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg"
        />
      </label>
    </section>
  );
}
