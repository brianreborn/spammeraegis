import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "danger" | "warn" | "ok" | "accent";
  children: ReactNode;
}) {
  const tones = {
    muted: "bg-raised text-muted border-border",
    danger: "bg-danger/15 text-danger border-danger/30",
    warn: "bg-warn/15 text-warn border-warn/30",
    ok: "bg-ok/15 text-ok border-ok/30",
    accent: "bg-accent/15 text-accent border-accent/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-xs tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
