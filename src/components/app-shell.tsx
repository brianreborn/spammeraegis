import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  Ban,
  Crosshair,
  Download,
  FolderInput,
  LayoutGrid,
  Network,
  Radar,
  ScrollText,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCasefile } from "@/store/casefile";

const NAV = [
  { id: "desk", label: "Desk", icon: LayoutGrid },
  { id: "import", label: "Import", icon: FolderInput },
  { id: "graph", label: "Graph", icon: Network },
  { id: "alts", label: "Alts", icon: Shield },
  { id: "crawl", label: "Crawl", icon: Radar },
  { id: "queue", label: "Queue", icon: Ban },
  { id: "capture", label: "Capture", icon: Crosshair },
  { id: "export", label: "Export", icon: Download },
  { id: "log", label: "Log", icon: ScrollText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const view = useCasefile((s) => s.view);
  const setView = useCasefile((s) => s.setView);
  const cf = useCasefile((s) => s.cf);
  const clusters = useCasefile((s) => s.clusters);
  const unread = cf.alerts.filter((a) => !a.read).length;
  const openQ = cf.queue.filter((q) => q.status !== "done").length;

  useEffect(() => {
    const apply = () => {
      const m = window.location.hash.match(/[#&](?:spammeraegis|altbreak)=([^&]+)/);
      if (!m?.[1]) return;
      try {
        const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const bytes = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
        const json = JSON.parse(new TextDecoder().decode(bytes)) as {
          username?: string;
          id?: string;
          displayName?: string;
          bio?: string;
        };
        useCasefile.getState().captureAccount({ ...json, queue: true });
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        /* ignore malformed companion payloads */
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setView("desk")}>
            <span className="flex size-9 items-center justify-center rounded-md border border-border bg-surface">
              <Shield className="size-4 text-accent" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="block font-semibold tracking-tight">SpammerAegis</span>
                <span className="rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent">
                  {APP_RELEASE}
                </span>
              </span>
              <span className="block truncate font-mono text-xs text-muted">
                {cf.name}
                {cf.isDemo ? " · sample" : ""}
              </span>
            </span>
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <Meta k="accounts" v={Object.keys(cf.accounts).length} />
            <Meta k="alts" v={clusters.length} />
            <Meta k="queue" v={openQ} hot={openQ > 0} />
            {unread > 0 && <Meta k="alerts" v={unread} hot />}
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            const count =
              item.id === "alts" ? clusters.length
              : item.id === "queue" ? openQ
              : item.id === "log" ? unread
              : undefined;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors duration-150",
                  active ? "bg-raised text-fg" : "text-muted hover:bg-surface hover:text-fg",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
                {count ? (
                  <span className="font-mono text-xs text-accent">{count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>
      <main className={cn("mx-auto w-full", view === "graph" ? "max-w-none" : "max-w-6xl px-4 py-5")}>
        {children}
      </main>
    </div>
  );
}

function Meta({ k, v, hot }: { k: string; v: number; hot?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-xs">
      <span className="text-subtle">{k}</span>
      <span className={hot ? "text-danger" : "text-fg"}>{v}</span>
    </span>
  );
}
