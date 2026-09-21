import type { Casefile } from "./types.ts";

export type Watcher = {
  accountId: string;
  reasons: string[];
  severity: "high" | "medium";
};

/** Blocked/muted accounts that still follow a case owner, or were recaptured after the block. */
export function findWatchers(cf: Casefile): Watcher[] {
  const ownerIds = new Set(
    cf.archives.map((a) => a.accountId).filter((id): id is string => Boolean(id)),
  );
  const out: Watcher[] = [];
  for (const acc of Object.values(cf.accounts)) {
    if (ownerIds.has(acc.id)) continue;
    const reasons: string[] = [];
    const followsOwner = cf.relations.some(
      (r) => r.type === "follow" && r.source === acc.id && ownerIds.has(r.target),
    );
    const mentionsOwner = cf.relations.some(
      (r) => r.type === "mention" && r.source === acc.id && ownerIds.has(r.target),
    );
    if (acc.blockedIn.length && followsOwner) {
      reasons.push("Blocked, still follows a case owner");
    }
    if (acc.mutedIn.length && followsOwner) {
      reasons.push("Muted, still follows a case owner");
    }
    if (acc.blockedIn.length && acc.capturedAt) {
      reasons.push("Blocked account recaptured after the archive");
    }
    if ((acc.blockedIn.length || acc.mutedIn.length) && mentionsOwner) {
      reasons.push("Mentions a case owner after block or mute");
    }
    if (!reasons.length) continue;
    out.push({
      accountId: acc.id,
      reasons,
      severity: acc.blockedIn.length && followsOwner ? "high" : "medium",
    });
  }
  out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return b.reasons.length - a.reasons.length;
  });
  return out;
}
