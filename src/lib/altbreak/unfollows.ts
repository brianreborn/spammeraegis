import type { ArchiveMeta, Casefile, UnfollowRow } from "./types";

/** Port of twitter-archive-tools/find-unfollows.rb for dated archives of one owner. */
export function findUnfollows(cf: Casefile): UnfollowRow[] {
  const dated = cf.archives
    .filter((a) => a.kind === "x-archive" && a.date && a.accountId)
    .slice()
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  if (dated.length < 2) return [];

  const byOwner = new Map<string, ArchiveMeta[]>();
  for (const a of dated) {
    const id = a.accountId!;
    const list = byOwner.get(id) ?? [];
    list.push(a);
    byOwner.set(id, list);
  }

  const rows: UnfollowRow[] = [];
  for (const [, archives] of byOwner) {
    if (archives.length < 2) continue;
    const last = archives[archives.length - 1]!;
    const lastId = last.id;
    const stillFollower = new Set<string>();
    const stillFollowing = new Set<string>();
    const wasFollowerOn = new Map<string, string[]>();

    for (const rel of cf.relations) {
      if (rel.type !== "follow") continue;
      const arch = cf.archives.find((a) => a.id === rel.archiveId);
      if (!arch || !archives.some((a) => a.id === arch.id)) continue;
      if (rel.target === last.accountId) {
        const dates = wasFollowerOn.get(rel.source) ?? [];
        if (arch.date && !dates.includes(arch.date)) dates.push(arch.date);
        wasFollowerOn.set(rel.source, dates);
        if (rel.archiveId === lastId) stillFollower.add(rel.source);
      }
      if (rel.source === last.accountId && rel.archiveId === lastId) {
        stillFollowing.add(rel.target);
      }
    }

    for (const [accountId, seenOn] of wasFollowerOn) {
      if (!stillFollower.has(accountId) && stillFollowing.has(accountId)) {
        rows.push({ accountId, seenOn, stillFollowing: true });
      }
    }
  }
  return rows;
}

export function blockMuteTimeline(cf: Casefile): { date: string; blocks: number; mutes: number; archiveId: string }[] {
  return cf.archives
    .filter((a) => a.date)
    .slice()
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((a) => ({
      date: a.date!,
      blocks: a.counts.blocks,
      mutes: a.counts.mutes,
      archiveId: a.id,
    }));
}
