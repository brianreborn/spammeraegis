import type { Account, Alert, AltCluster, Casefile, Evidence, Flag, PairHit, Relation } from "./types";
import { jaccard, jaroWinkler, levenshtein, overlapCount, stemHandle, tokenize } from "./similarity";
import { findWatchers } from "./watchers";

const PAIR_THRESHOLD = 42;

function followsOf(relations: Relation[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of relations) {
    if (r.type !== "follow") continue;
    const set = map.get(r.source) ?? new Set();
    set.add(r.target);
    map.set(r.source, set);
  }
  return map;
}

function label(acc?: Account): string {
  if (!acc) return "unknown";
  if (acc.username) return `@${acc.username}`;
  if (acc.displayName) return acc.displayName;
  return `#${acc.id}`;
}

function handleScore(a: Account, b: Account): Evidence | null {
  if (!a.username || !b.username) return null;
  const ha = a.username.toLowerCase();
  const hb = b.username.toLowerCase();
  if (ha === hb) return { kind: "handle", detail: `Identical handle ${ha}`, weight: 55 };
  const sa = stemHandle(ha);
  const sb = stemHandle(hb);
  if (sa && sb && sa === sb && sa.length >= 4) {
    return { kind: "handle", detail: `Same handle stem “${sa}”`, weight: 38 };
  }
  const jw = jaroWinkler(ha, hb);
  const dist = levenshtein(ha, hb);
  if (jw >= 0.92 || dist <= 2) {
    return { kind: "handle", detail: `Handles ${ha} / ${hb} (distance ${dist})`, weight: 28 };
  }
  if (jw >= 0.84) {
    return { kind: "handle", detail: `Similar handles ${ha} / ${hb}`, weight: 16 };
  }
  return null;
}

function displayScore(a: Account, b: Account): Evidence | null {
  if (!a.displayName || !b.displayName) return null;
  const da = a.displayName.toLowerCase().replace(/\s+/g, " ").trim();
  const db = b.displayName.toLowerCase().replace(/\s+/g, " ").trim();
  if (da === db) return { kind: "display", detail: `Same display name “${a.displayName}”`, weight: 18 };
  if (jaroWinkler(da, db) >= 0.9) {
    return { kind: "display", detail: `Similar display names`, weight: 10 };
  }
  return null;
}

function bioScore(a: Account, b: Account): Evidence | null {
  if (!a.bio || !b.bio) return null;
  const ja = jaccard(tokenize(a.bio), tokenize(b.bio));
  if (ja >= 0.45) return { kind: "bio", detail: `Bios overlap ${(ja * 100).toFixed(0)}%`, weight: 18 };
  if (ja >= 0.28) return { kind: "bio", detail: `Bios share phrasing`, weight: 10 };
  return null;
}

function followScore(
  a: Account,
  b: Account,
  followMap: Map<string, Set<string>>,
): Evidence | null {
  const fa = followMap.get(a.id);
  const fb = followMap.get(b.id);
  if (!fa || !fb || fa.size < 3 || fb.size < 3) return null;
  const n = overlapCount(fa, fb);
  if (n >= 8) return { kind: "follows", detail: `${n} shared follows`, weight: 22 };
  if (n >= 4) return { kind: "follows", detail: `${n} shared follows`, weight: 14 };
  if (n >= 2 && jaccard(fa, fb) >= 0.25) {
    return { kind: "follows", detail: `${n} shared follows`, weight: 8 };
  }
  return null;
}

function blockScore(a: Account, b: Account): Evidence | null {
  const shared = a.blockedIn.filter((x) => b.blockedIn.includes(x));
  if (shared.length >= 2) {
    return { kind: "blocks", detail: `Blocked in ${shared.length} shared archives`, weight: 24 };
  }
  if (shared.length === 1 && (a.blockedIn.length || b.blockedIn.length)) {
    return { kind: "blocks", detail: `Co-blocked in the same archive`, weight: 8 };
  }
  return null;
}

function watchScore(a: Account, b: Account, relations: Relation[], ownerIds: Set<string>): Evidence | null {
  const aWatches = relations.some((r) => r.type === "follow" && r.source === a.id && ownerIds.has(r.target));
  const bWatches = relations.some((r) => r.type === "follow" && r.source === b.id && ownerIds.has(r.target));
  if (aWatches && bWatches && (a.blockedIn.length || b.blockedIn.length)) {
    return { kind: "watch", detail: "Both still follow a case owner after blocks", weight: 10 };
  }
  return null;
}

function scorePair(
  a: Account,
  b: Account,
  followMap: Map<string, Set<string>>,
  relations: Relation[],
  ownerIds: Set<string>,
): PairHit | nu
... 