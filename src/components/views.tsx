import { useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraphCanvas } from "@/components/graph-canvas";
import { CrawlView } from "@/components/crawl-view";
import { AboutView } from "@/components/about-view";
import { Dossier } from "@/components/dossier";
import { buildSampleZip } from "@/lib/altbreak/demo";
import {
  blocklistText,
  caseJson,
  downloadForensicsZip,
  downloadGephiBundle,
} from "@/lib/altbreak/gephi";
import { findUnfollows, blockMuteTimeline } from "@/lib/altbreak/unfollows";
import { findWatchers } from "@/lib/altbreak/watchers";
import { downloadFieldKitXpi } from "@/lib/altbreak/field-kit";
import { downloadText, formatInt, formatWhen, handleOf, xIntentUserUrl } from "@/lib/utils";
import { useCasefile } from "@/store/casefile";
import { toast, Toaster } from "sonner";

export function Workbench() {
  const view = useCasefile((s) => s.view);
  return (
    <>
      <Toaster theme="dark" position="bottom-center" />
      {view === "desk" && <DeskView />}
      {view === "import" && <ImportView />}
      {view === "graph" && <GraphView />}
      {view === "alts" && <AltsView />}
      {view === "queue" && <QueueView />}
      {view === "capture" && <CaptureView />}
      {view === "crawl" && <CrawlView />}
      {view === "export" && <ExportView />}
      {view === "log" && <LogView />}
      {view === "about" && <AboutView />}
    </>
  );
}

function DeskView() {
  const cf = useCasefile((s) => s.cf);
  const clusters = useCasefile((s) => s.clusters);
  const selectedId = useCasefile((s) => s.selectedId);
  const setView = useCasefile((s) => s.setView);
  const loadDemo = useCasefile((s) => s.loadDemo);
  const markAlertRead = useCasefile((s) => s.markAlertRead);
  const setName = useCasefile((s) => s.setName);
  const select = useCasefile((s) => s.select);
  const queueWatchers = useCasefile((s) => s.queueWatchers);
  const [editingName, setEditingName] = useState(false);
  const accounts = Object.keys(cf.accounts).length;
  const blocked = Object.values(cf.accounts).filter((a) => a.blockedIn.length).length;
  const openQ = cf.queue.filter((q) => q.status !== "done").length;
  const unread = cf.alerts.filter((a) => !a.read);
  const timeline = blockMuteTimeline(cf);
  const unfollows = findUnfollows(cf);
  const watchers = findWatchers(cf);

  return (
    <div className="flex flex-col gap-5">
      {cf.isDemo && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Sample case <span className="text-fg">Repeat Knock</span> is loaded so you can try alt
            detection immediately. Import your own X archive ZIP to replace it — nothing leaves this browser.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button onClick={() => setView("import")}>Import archive</Button>
            <Button variant="secondary" onClick={() => setView("alts")}>
              See alts
            </Button>
            <Button variant="ghost" onClick={() => setView("crawl")}>
              Live crawl
            </Button>
          </div>
        </div>
      )}

      <section>
        {editingName ? (
          <input
            aria-label="Case name"
            className="h-11 w-full max-w-lg rounded-md border border-border bg-bg px-3 text-2xl font-semibold tracking-tight"
            defaultValue={cf.name}
            autoFocus
            onBlur={(e) => {
              setName(e.target.value);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingName(false);
            }}
          />
        ) : (
          <button type="button" className="text-left" onClick={() => setEditingName(true)}>
            <h1 className="text-2xl font-semibold tracking-tight">{cf.name}</h1>
            <span className="sr-only">Rename case</span>
          </button>
        )}
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Local X forensics desk. Seed blocks from an archive, live-check handles for odd returns,
          flag alts, export Gephi graphs. Storage stays on this device. Firefox and Vanadium both run
          this page; only Firefox can also load the companion add-on.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Accounts" value={formatInt(accounts)} onClick={() => setView("graph")} />
        <Stat label="Blocked" value={formatInt(blocked)} onClick={() => setView("queue")} />
        <Stat label="Alt clusters" value={formatInt(clusters.length)} onClick={() => setView("alts")} />
        <Stat label="Open queue" value={formatInt(openQ)} onClick={() => setView("queue")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-border bg-surface p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Alerts</h2>
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setView("alts")}>
              Open clusters
            </button>
          </div>
          {unread.length === 0 ? (
            <p className="text-sm text-muted">No unread alerts. Import another archive or live-check a handle.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {unread.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-start justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-left hover:border-border-strong"
                    onClick={() => {
                      markAlertRead(a.id);
                      if (a.accountIds[0]) select(a.accountIds[0]);
                      setView("alts");
                    }}
                  >
                    <span>
                      <span className="block text-sm">{a.title}</span>
                      <span className="block text-xs text-muted">{a.detail}</span>
                    </span>
                    <Badge tone={a.severity === "high" ? "danger" : a.severity === "medium" ? "warn" : "muted"}>
                      {a.severity}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-sm font-medium">Case</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <li>Archives {cf.archives.length}</li>
            <li>Watchers {watchers.length}</li>
            <li>Unfollows {unfollows.length}</li>
            <li>Timeline rows {timeline.length}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={loadDemo}>
              Reload sample
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setView("import")}>
              <FolderInput /> Import
            </Button>
          </div>
        </section>
      </div>

      {watchers.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Still watching</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-danger">{watchers.length}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const n = queueWatchers();
                  toast.success(n ? `Queued ${n} watchers` : "Watchers already in the queue");
                }}
              >
                Queue all
              </Button>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {watchers.slice(0, 8).map((w) => {
              const acc = cf.accounts[w.accountId];
              if (!acc) return null;
              return (
                <li key={w.accountId}>
                  <button
                    type="button"
                    onClick={() => {
                      select(w.accountId);
                      setView("graph");
                    }}
                    className="flex min-h-11 w-full items-start justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-left hover:border-border-strong"
                  >
                    <span>
                      <span className="block font-mono text-sm">{handleOf(acc)}</span>
                      <span className="block text-xs text-muted">{w.reasons[0]}</span>
                    </span>
                    <Badge tone={w.severity === "high" ? "danger" : "warn"}>{w.severity}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {selectedId && cf.accounts[selectedId] && <Dossier accountId={selectedId} />}
    </div>
  );
}

function GraphView() {
  const selectedId = useCasefile((s) => s.selectedId);
  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="px-4">
        <h1 className="text-2xl font-semibold tracking-tight">Graph</h1>
        <p className="mt-1 text-sm text-muted">Follow edges in steel, blocks in red. Tap a node for the dossier.</p>
      </div>
      <GraphCanvas />
      {selectedId && (
        <div className="mx-4">
          <Dossier accountId={selectedId} />
        </div>
      )}
    </div>
  );
}

function ImportView() {
  const importFiles = useCasefile((s) => s.importFiles);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
      <p className="max-w-2xl text-sm text-muted">
        Drop an official X archive ZIP. We read <span className="font-mono text-fg">data/block.js</span>,{" "}
        <span className="font-mono text-fg">mute.js</span>,{" "}
        <span className="font-mono text-fg">follower.js</span>,{" "}
        <span className="font-mono text-fg">following.js</span>, and account/profile. Also accepts
        twitter-forensics <span className="font-mono text-fg">@user/*.json</span> folders, loose YTD
        files, and a SpammerAegis case JSON backup. Multi-archive imports merge locally.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".zip,.js,.json"
        onChange={(e) => {
          const files = e.target.files;
          if (!files?.length) return;
          setBusy(true);
          void importFiles(files)
            .then((w) => toast.success(w.length ? `Imported with ${w.length} warning(s)` : "Imported"))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Import failed"))
            .finally(() => setBusy(false));
        }}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload /> Choose files
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          void buildSampleZip().then((blob) => {
            const file = new File([blob], "twitter-2026-08-02-sample.zip", { type: "application/zip" });
            void importFiles([file]).then(() => toast.success("Sample ZIP imported"));
          });
        }}
      >
        <FolderInput /> Import sample ZIP
      </Button>
    </div>
  );
}

function AltsView() {
  const clusters = useCasefile((s) => s.clusters);
  const cf = useCasefile((s) => s.cf);
  const flagCluster = useCasefile((s) => s.flagCluster);
  const flagAllClusters = useCasefile((s) => s.flagAllClusters);
  const select = useCasefile((s) => s.select);
  const setView = useCasefile((s) => s.setView);
  const [floor, setFloor] = useState(0);
  const shown = clusters.filter((c) => c.score >= floor);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Alts</h1>
        <Button onClick={flagAllClusters} disabled={!clusters.length}>
          <Shield /> Batch-flag all
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { n: 0, label: "All" },
          { n: 55, label: "≥ 55" },
          { n: 70, label: "≥ 70" },
        ].map((opt) => (
          <Button
            key={opt.n}
            size="sm"
            variant={floor === opt.n ? "secondary" : "ghost"}
            onClick={() => setFloor(opt.n)}
          >
            {opt.label}
          </Button>
        ))}
        <span className="self-center font-mono text-xs text-subtle">
          {shown.length}/{clusters.length}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          {clusters.length
            ? "Nothing at this score floor. Drop the filter to see weaker clusters."
            : "No clusters yet. Load the sample case or import archives that include blocks plus usernames."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-subtle">score {c.score}</div>
                  <div className="mt-1 text-sm">
                    {c.memberIds.map((id) => handleOf(cf.accounts[id] ?? { id })).join(" · ")}
                  </div>
                  <p className="mt-1 text-xs text-muted">{c.evidence[0]?.detail}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    flagCluster(c);
                    toast.success("Cluster flagged into the queue");
                  }}
                >
                  Flag
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.memberIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="rounded-sm border border-border bg-bg px-2 py-1 font-mono text-xs"
                    onClick={() => {
                      select(id);
                      setView("graph");
                    }}
                  >
                    {handleOf(cf.accounts[id] ?? { id })}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueueView() {
  const cf = useCasefile((s) => s.cf);
  const setQueueStatus = useCasefile((s) => s.setQueueStatus);
  const reset = useCasefile((s) => s.reset);
  const open = cf.queue.filter((q) => q.status !== "done");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
        <Button size="sm" variant="ghost" onClick={reset}>
          <Trash2 /> Reset case
        </Button>
      </div>
      {open.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          Queue is empty. Flag a cluster or queue a watcher.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map((q) => {
            const acc = cf.accounts[q.accountId];
            return (
              <li key={q.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-mono text-sm">{acc ? handleOf(acc) : q.accountId}</div>
                    <p className="text-sm text-muted">{q.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {acc && (
                      <Button size="sm" variant="secondary" asChild>
                        <a href={xIntentUserUrl(acc.id)} target="_blank" rel="noreferrer">
                          <ExternalLink /> Open
                        </a>
                      </Button>
                    )}
                    {acc && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void navigator.clipboard.writeText(xIntentUserUrl(acc.id));
                          setQueueStatus(q.id, "copied");
                          toast.success("Intent URL copied");
                        }}
                      >
                        <Copy /> Copy URL
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setQueueStatus(q.id, "done")}>
                      <Check /> Done
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const bookmarklet =
  "javascript:(function(){const u=(location.pathname.split('/').filter(Boolean)[0]||'').replace(/^@/,'');const payload=btoa(unescape(encodeURIComponent(JSON.stringify({username:u,displayName:document.title,bio:''})))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');navigator.clipboard.writeText(payload).then(()=>alert('Copied '+u+' — paste into SpammerAegis Capture.')).catch(()=>prompt('Copy this',payload));})();";

function CaptureView() {
  const captureAccount = useCasefile((s) => s.captureAccount);
  const [raw, setRaw] = useState("");
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Capture</h1>
      <p className="max-w-2xl text-sm text-muted">
        Paste a handle or a field-kit payload. Nothing is sent to a remote case store.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={bookmarklet}
          className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-raised px-4 text-sm"
          onClick={(e) => {
            e.preventDefault();
            void navigator.clipboard.writeText(bookmarklet);
            toast.success("Bookmarklet copied — paste it as a bookmark URL.");
          }}
        >
          Copy capture bookmarklet
        </a>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void downloadFieldKitXpi()
              .then(() => toast.success("XPI downloaded — about:debugging → Load Temporary Add-on"))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not pack the add-on"));
          }}
        >
          <Download /> Download Firefox .xpi
        </Button>
      </div>
      <textarea
        className="min-h-32 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="@handle or pasted payload"
      />
      <Button
        onClick={() => {
          const t = raw.trim();
          if (!t) return;
          try {
            const b64 = t.replace(/-/g, "+").replace(/_/g, "/");
            const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
            const json = JSON.parse(decodeURIComponent(escape(atob(pad)))) as {
              username?: string;
              id?: string;
              displayName?: string;
              bio?: string;
            };
            captureAccount({ ...json, queue: true });
          } catch {
            captureAccount({ username: t.replace(/^@/, ""), queue: true });
          }
          setRaw("");
          toast.success("Captured into this case");
        }}
      >
        Capture
      </Button>
    </div>
  );
}

function ExportView() {
  const cf = useCasefile((s) => s.cf);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <ExportCard
          title="Gephi CSV + GEXF"
          detail="nodes.csv, edges.csv, graph.gexf matching twitter-forensics ingest."
          onClick={() => downloadGephiBundle(cf)}
        />
        <ExportCard
          title="twitter-forensics NDJSON ZIP"
          detail="Case JSON plus user/relation/log NDJSON."
          onClick={() => void downloadForensicsZip(cf)}
        />
        <ExportCard
          title="Full case JSON"
          detail="Local backup of this browser casefile. Re-import to restore."
          onClick={() => downloadText("spammeraegis-case.json", caseJson(cf), "application/json")}
        />
        <ExportCard
          title="Case log NDJSON"
          detail="One JSON object per log line for forensics scripts."
          onClick={() =>
            downloadText(
              "spammeraegis-log.ndjson",
              cf.logs.map((l) => JSON.stringify(l)).join("\n"),
              "application/x-ndjson",
            )
          }
        />
        <ExportCard
          title="Blocklist text"
          detail="id / username / display from blocked and queued accounts."
          onClick={() => downloadText("blocklist.tsv", blocklistText(cf), "text/tab-separated-values")}
        />
      </div>
    </div>
  );
}

function ExportCard({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-surface p-4 text-left hover:border-border-strong"
    >
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </button>
  );
}

function LogView() {
  const cf = useCasefile((s) => s.cf);
  const [kind, setKind] = useState<string>("all");
  const kinds = Array.from(new Set(cf.logs.map((l) => l.kind)));
  const rows = kind === "all" ? cf.logs : cf.logs.filter((l) => l.kind === kind);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
      {cf.logs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={kind === "all" ? "secondary" : "ghost"} onClick={() => setKind("all")}>
            All
          </Button>
          {kinds.map((k) => (
            <Button key={k} size="sm" variant={kind === k ? "secondary" : "ghost"} onClick={() => setKind(k)}>
              {k}
            </Button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          No events yet. Imports, captures, crawls, and flags land here.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((l) => (
            <li key={l.id} className="rounded-md border border-border bg-surface px-3 py-3">
              <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-subtle">
                <span>{l.kind}</span>
                <span>{formatWhen(l.at)}</span>
              </div>
              <p className="mt-1 text-sm">{l.message}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-surface p-4 text-left hover:border-border-strong"
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-xl">{value}</div>
    </button>
  );
}
 