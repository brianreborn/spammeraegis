import { useRef, useState } from "react";
import {
  AlertTriangle,
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
     
... 