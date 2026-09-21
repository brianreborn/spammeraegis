import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { downloadFieldKitXpi } from "@/lib/altbreak/field-kit";
import {
  APP_NAME,
  APP_RELEASE,
  APP_RELEASED,
  CHANGELOG,
  LIMITS,
  REQUIREMENTS,
  SHORTCUTS,
} from "@/lib/altbreak/release";
import { toast } from "sonner";

const TONE = {
  ships: "ok" as const,
  partial: "warn" as const,
  later: "muted" as const,
};

export function AboutView() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <Badge tone="accent">{APP_RELEASE}</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Local X forensics desk, first alpha. Seed a case from an archive, live-check odd
          returns, cluster alts, queue the people who keep watching. Nothing is uploaded.
          Cut {APP_RELEASED}.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">What this cut ships</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {REQUIREMENTS.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-bg px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <div className="text-sm">
                  <span className="font-mono text-xs text-subtle">{r.id}.</span> {r.title}
                </div>
                <p className="mt-0.5 text-xs text-muted">{r.note}</p>
              </div>
              <Badge tone={TONE[r.status]}>{r.status}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">Known limits</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            {LIMITS.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-medium">Keys</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="contents">
                <dt className="rounded-sm border border-border bg-bg px-1.5 py-0.5 text-center text-fg">
                  {s.keys}
                </dt>
                <dd className="self-center text-muted">{s.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium">Firefox field kit</h2>
          <p className="mt-1 text-sm text-muted">
            Unsigned .xpi for standard Firefox: about:debugging → This Firefox → Load Temporary
            Add-on.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            void downloadFieldKitXpi()
              .then(() => toast.success("XPI downloaded"))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Pack failed"));
          }}
        >
          <Download /> Download {APP_RELEASE}.xpi
        </Button>
      </section>

      <section>
        <h2 className="text-sm font-medium">Changelog</h2>
        {CHANGELOG.map((c) => (
          <div key={c.version} className="mt-3 rounded-xl border border-border bg-surface p-4">
            <div className="font-mono text-xs text-subtle">
              {c.version} · {c.date}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm
... 