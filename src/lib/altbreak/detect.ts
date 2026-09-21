import type { Account, Alert, AltCluster, Casefile, Evidence, Flag, PairHit, Relation } from "./types.ts";
import { jaccard, jaroWinkler, levenshtein, overlapCount, stemHandle, tokenize } from "./similarity.ts";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

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

function createdScore(a: Account, b: Account): Evidence | null {
  if (!a.createdAt || !b.createdAt) return null;
  const da = new Date(a.createdAt).getTime();
  const db = new Date(b.createdAt).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  const days = Math.abs(da - db) / 86400000;
  if (days <= 3) return { kind: "created", detail: `Created ${days.toFixed(0)} days apart`, weight: 10 };
  if (days <= 14) return { kind: "created", detail: "Created within two weeks", weight: 6 };
  return null;
}

function scorePair(
  a: Account,
  b: Account,
  followMap: Map<string, Set<string>>,
  relations: Relation[],
  ownerIds: Set<string>,
): PairHit | null {
  const evidence = [
    handleScore(a, b),
    displayScore(a, b),
    bioScore(a, b),
    followScore(a, b, followMap),
    blockScore(a, b),
    watchScore(a, b, relations, ownerIds),
    createdScore(a, b),
  ].filter((e): e is Evidence => Boolean(e));
  const score = evidence.reduce((n, e) => n + e.weight, 0);
  if (score < PAIR_THRESHOLD) return null;
  return { a: a.id, b: b.id, score, evidence };
}

function find(parent: Map<string, string>, x: string): string {
  let cur = x;
  while (parent.get(cur) !== cur) {
    const p = parent.get(cur) ?? cur;
    parent.set(cur, parent.get(p) ?? p);
    cur = p;
  }
  return cur;
}

export function detectAlts(cf: Casefile): { clusters: AltCluster[]; alerts: Alert[] } {
  const accounts = Object.values(cf.accounts);
  const followMap = followsOf(cf.relations);
  const ownerIds = new Set(
    cf.archives.map((a) => a.accountId).filter((id): id is string => Boolean(id)),
  );
  const pairs: PairHit[] = [];
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i]!;
    if (ownerIds.has(a.id)) continue;
    for (let j = i + 1; j < accounts.length; j++) {
      const b = accounts[j]!;
      if (ownerIds.has(b.id)) continue;
      const hit = scorePair(a, b, followMap, cf.relations, ownerIds);
      if (hit) pairs.push(hit);
    }
  }

  const parent = new Map<string, string>();
  const touch = (id: string) => {
    if (!parent.has(id)) parent.set(id, id);
  };
  for (const p of pairs) {
    touch(p.a);
    touch(p.b);
    const ra = find(parent, p.a);
    const rb = find(parent, p.b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(parent, id);
    const list = groups.get(root) ?? [];
    list.push(id);
    groups.set(root, list);
  }

  const clusters: AltCluster[] = [];
  let n = 0;
  for (const memberIds of groups.values()) {
    if (memberIds.length < 2) continue;
    const members = new Set(memberIds);
    const groupPairs = pairs.filter((p) => members.has(p.a) && members.has(p.b));
    const evidence = groupPairs
      .flatMap((p) => p.evidence)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
    const score = groupPairs.reduce((m, p) => Math.max(m, p.score), 0);
    const followSets = memberIds.map((id) => followMap.get(id) ?? new Set<string>());
    let sharedFollows: string[] = [];
    if (followSets.length) {
      const shared = new Set(followSets[0]);
      for (const s of followSets.slice(1)) {
        for (const id of [...shared]) if (!s.has(id)) shared.delete(id);
      }
      sharedFollows = [...shared];
    }
    const blockSets = memberIds.map((id) => new Set(cf.accounts[id]?.blockedIn ?? []));
    let sharedBlockArchives: string[] = [];
    if (blockSets.length) {
      const shared = new Set(blockSets[0]);
      for (const s of blockSets.slice(1)) {
        for (const id of [...shared]) if (!s.has(id)) shared.delete(id);
      }
      sharedBlockArchives = [...shared];
    }
    n += 1;
    clusters.push({
      id: `clu_${n}`,
      memberIds,
      score,
      evidence,
      sharedFollows,
      sharedBlockArchives,
    });
  }
  clusters.sort((a, b) => b.score - a.score);

  const alerts: Alert[] = [];
  for (const c of clusters.slice(0, 12)) {
    alerts.push({
      id: `alt_${c.id}`,
      at: new Date().toISOString(),
      title: `Alt cluster score ${c.score}`,
      detail: `${c.memberIds.map((id) => label(cf.accounts[id])).join(" · ")} — ${c.evidence[0]?.detail ?? "linked"}`,
      accountIds: c.memberIds,
      severity: c.score >= 70 ? "high" : c.score >= 55 ? "medium" : "low",
      read: false,
    });
  }

  const blockCounts = new Map<string, number>();
  for (const acc of accounts) {
    if (acc.blockedIn.length >= 2) blockCounts.set(acc.id, acc.blockedIn.length);
  }
  for (const [id, count] of blockCounts) {
    alerts.push({
      id: `multi_${id}`,
      at: new Date().toISOString(),
      title: `Blocked in ${count} archives`,
      detail: `${label(cf.accounts[id])} appears on multiple archive block lists.`,
      accountIds: [id],
      severity: count >= 3 ? "high" : "medium",
      read: false,
    });
  }

  return { clusters, alerts };
}

export function applyBatchFlags(cf: Casefile, clusters: AltCluster[]): Casefile {
  const at = new Date().toISOString();
  const batch = clusters.length > 1;
  for (const cluster of clusters) {
    for (const accountId of cluster.memberIds) {
      if (!cf.flags.some((f) => f.accountId === accountId && f.clusterId === cluster.id)) {
        const flag: Flag = {
          id: uid("flag"),
          accountId,
          clusterId: cluster.id,
          score: cluster.score,
          reasons: cluster.evidence.map((e) => e.detail),
          at,
          batch,
        };
        cf.flags.push(flag);
      }
      if (!cf.queue.some((q) => q.accountId === accountId && q.status !== "done")) {
        cf.queue.unshift({
          id: uid("q"),
          accountId,
          reason: `Alt cluster ${cluster.score}`,
          status: "open",
          addedAt: at,
        });
      }
    }
    cf.logs.unshift({
      id: uid("log"),
      at,
      kind: "flag",
      message: `Flagged cluster of ${cluster.memberIds.length} (score ${cluster.score}).`,
    });
  }
  return cf;
}
 