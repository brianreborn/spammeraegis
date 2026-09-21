import type { Account, ArchiveMeta, ImportResult, Relation } from "./types.ts";
import { EMPTY_COUNTS } from "./types.ts";
import {
  archiveDateFromFilename,
  parseAccountFile,
  parseIdList,
  parseProfileBio,
  parseTweetInteractions,
} from "./parse-ytd.ts";
import {
  accountFromForensics,
  followRelations,
  parseNdjson,
  userFromFragment,
  type ForensicsUser,
} from "./parse-forensics.ts";
import { uid } from "../utils.ts";

const YTD_STEPS = [
  { file: "block.js", nested: "blocking", rel: "block" as const, count: "blocks" as const },
  { file: "mute.js", nested: "muting", rel: "mute" as const, count: "mutes" as const },
  { file: "follower.js", nested: "follower", rel: "follow" as const, count: "followers" as const },
  { file: "following.js", nested: "following", rel: "follow" as const, count: "following" as const },
];

function findFile(
  files: Record<string, { async: (t: "string") => Promise<string> }>,
  basename: string,
) {
  const lower = basename.toLowerCase();
  const keys = Object.keys(files);
  return (
    keys.find((k) => k.replace(/\\/g, "/").toLowerCase().endsWith(`/${lower}`)) ??
    keys.find((k) => k.replace(/\\/g, "/").toLowerCase().endsWith(lower))
  );
}

function emptyAccount(id: string, source: string): Account {
  return {
    id,
    sources: [source],
    blockedIn: [],
    mutedIn: [],
  };
}

function mergeAccount(into: Account, extra: Partial<Account>): Account {
  return {
    ...into,
    username: extra.username ?? into.username,
    displayName: extra.displayName ?? into.displayName,
    bio: extra.bio ?? into.bio,
    createdAt: extra.createdAt ?? into.createdAt,
    followersCount: extra.followersCount ?? into.followersCount,
    followingCount: extra.followingCount ?? into.followingCount,
    sources: Array.from(new Set([...into.sources, ...(extra.sources ?? [])])),
    blockedIn: Array.from(new Set([...into.blockedIn, ...(extra.blockedIn ?? [])])),
    mutedIn: Array.from(new Set([...into.mutedIn, ...(extra.mutedIn ?? [])])),
    capturedAt: extra.capturedAt ?? into.capturedAt,
  };
}

export async function parseArchiveBuffer(
  buf: ArrayBuffer,
  filename: string,
): Promise<ImportResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const files: Record<string, { async: (t: "string") => Promise<string> }> = {};
  zip.forEach((path, file) => {
    if (!file.dir) files[path] = file;
  });
  const paths = Object.keys(files);

  const looksForensics = paths.some((p) => /(^|\/)@[^/]+\/(user|followers|following)\.json$/i.test(p));
  if (looksForensics) return parseForensicsZip(files, filename);

  return parseXArchiveZip(files, filename);
}

async function parseXArchiveZip(
  files: Record<string, { async: (t: "string") => Promise<string> }>,
  filename: string,
): Promise<ImportResult> {
  const archiveId = uid("arc");
  const { date } = archiveDateFromFilename(filename);
  const warnings: string[] = [];
  const accounts = new Map<string, Account>();
  const relations: Relation[] = [];
  const counts = { ...EMPTY_COUNTS };

  let owner: Account | undefined;
  const accountPath = findFile(files, "account.js");
  const profilePath = findFile(files, "profile.js");
  if (accountPath) {
    try {
      const acc = parseAccountFile(await files[accountPath].async("string"));
      if (acc?.accountId) {
        owner = emptyAccount(acc.accountId, archiveId);
        owner.username = acc.username;
        owner.displayName = acc.displayName;
        owner.createdAt = acc.createdAt;
        accounts.set(owner.id, owner);
      }
    } catch (err) {
      warnings.push(`Could not parse account.js: ${err instanceof Error ? err.message : "error"}`);
    }
  }
  if (owner && profilePath) {
    try {
      const bio = parseProfileBio(await files[profilePath].async("string"));
      if (bio) {
        owner.bio = bio;
        accounts.set(owner.id, owner);
      }
    } catch {
      warnings.push("Could not parse profile.js");
    }
  }

  for (const step of YTD_STEPS) {
    const path = findFile(files, step.file);
    if (!path) continue;
    try {
      const ids = parseIdList(await files[path]!.async("string"), step.nested);
      counts[step.count] = ids.length;
      for (const id of ids) {
        const acc = accounts.get(id) ?? emptyAccount(id, archiveId);
        if (step.rel === "block") acc.blockedIn = Array.from(new Set([...acc.blockedIn, archiveId]));
        if (step.rel === "mute") acc.mutedIn = Array.from(new Set([...acc.mutedIn, archiveId]));
        accounts.set(id, acc);
        if (owner) {
          if (step.rel === "block" || step.rel === "mute") {
            relations.push({ id: uid("rel"), source: owner.id, target: id, type: step.rel, archiveId });
          } else if (step.count === "followers") {
            relations.push({ id: uid("rel"), source: id, target: owner.id, type: "follow", archiveId });
          } else {
            relations.push({ id: uid("rel"), source: owner.id, target: id, type: "follow", archiveId });
          }
        }
      }
    } catch (err) {
      warnings.push(`Could not parse ${step.file}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  const tweetPath = findFile(files, "tweet.js") ?? findFile(files, "tweets.js");
  if (tweetPath) {
    try {
      const hits = parseTweetInteractions(await files[tweetPath].async("string"), owner?.id);
      counts.tweets = hits.filter((h) => h.kind === "reply").length;
      counts.mentions = hits.filter((h) => h.kind === "mention").length;
      for (const hit of hits) {
        if (!hit.targetId || !owner) continue;
        const acc = accounts.get(hit.targetId) ?? emptyAccount(hit.targetId, archiveId);
        if (hit.targetUsername) acc.username = acc.username ?? hit.targetUsername;
        accounts.set(hit.targetId, acc);
        relations.push({
          id: uid("rel"),
          source: owner.id,
          target: hit.targetId,
          type: hit.kind === "reply" ? "reply" : "mention",
          archiveId,
        });
      }
    } catch (err) {
      warnings.push(`Could not parse tweets: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return {
    archive: {
      id: archiveId,
      filename,
      date,
      accountId: owner?.id,
      username: owner?.username,
      displayName: owner?.displayName,
      bio: owner?.bio,
      importedAt: new Date().toISOString(),
      counts,
      kind: "x-archive",
    },
    accounts: [...accounts.values()],
    relations,
    warnings,
  };
}

async function parseForensicsZip(
  files: Record<string, { async: (t: "string") => Promise<string> }>,
  filename: string,
): Promise<ImportResult> {
  const archiveId = uid("arc");
  const warnings: string[] = [];
  const accounts = new Map<string, Account>();
  const relations: Relation[] = [];
  const counts = { ...EMPTY_COUNTS };
  const paths = Object.keys(files);
  const userPath = paths.find((p) => /(^|\/)@[^/]+\/user\.json$/i.test(p));
  let owner: ReturnType<typeof userFromFragment> | null = null;
  if (userPath) {
    const rows = parseNdjson(await files[userPath]!.async("string"));
    owner = rows.length ? userFromFragment(rows[0]!) : null;
    if (owner) accounts.set(owner.id, accountFromForensics(owner, archiveId));
  }
  for (const kind of ["followers", "following"] as const) {
    const path = paths.find((p) => new RegExp(`(^|/)@[^/]+/${kind}\\.json$`, "i").test(p));
    if (!path || !owner) continue;
    const others = parseNdjson(await files[path]!.async("string"))
      .map(userFromFragment)
      .filter((u): u is ForensicsUser => Boolean(u));
    if (kind === "followers") counts.followers = others.length;
    else counts.following = others.length;
    for (const u of others) accounts.set(u.id, accountFromForensics(u, archiveId));
    relations.push(...followRelations(owner, others, kind, archiveId));
  }
  return {
    archive: {
      id: archiveId,
      filename,
      date: archiveDateFromFilename(filename).date,
      accountId: owner?.id,
      username: owner?.username,
      displayName: owner?.displayName,
      importedAt: new Date().toISOString(),
      counts,
      kind: "forensics",
    },
    accounts: [...accounts.values()],
    relations,
    warnings,
  };
}

export async function parseLooseFile(text: string, filename: string): Promise<ImportResult> {
  const archiveId = uid("arc");
  const warnings: string[] = [];
  const lower = filename.toLowerCase();
  if (lower.includes("block")) {
    const ids = parseIdList(text, "blocking");
    return {
      archive: {
        id: archiveId,
        filename,
        date: archiveDateFromFilename(filename).date,
        importedAt: new Date().toISOString(),
        counts: { ...EMPTY_COUNTS, blocks: ids.length },
        kind: "ytd-file",
      },
      accounts: ids.map((id) => ({
        ...emptyAccount(id, archiveId),
        blockedIn: [archiveId],
      })),
      relations: [],
      warnings,
    };
  }
  if (lower.includes("mute")) {
    const ids = parseIdList(text, "muting");
    return {
      archive: {
        id: archiveId,
        filename,
        date: archiveDateFromFilename(filename).date,
        importedAt: new Date().toISOString(),
        counts: { ...EMPTY_COUNTS, mutes: ids.length },
        kind: "ytd-file",
      },
      accounts: ids.map((id) => ({
        ...emptyAccount(id, archiveId),
        mutedIn: [archiveId],
      })),
      relations: [],
      warnings,
    };
  }
  const rows = parseNdjson(text);
  if (rows.length) {
    const users = rows.map(userFromFragment).filter((u): u is ForensicsUser => Boolean(u));
    return {
      archive: {
        id: archiveId,
        filename,
        importedAt: new Date().toISOString(),
        counts: { ...EMPTY_COUNTS },
        kind: "forensics",
      },
      accounts: users.map((u) => accountFromForensics(u, archiveId)),
      relations: [],
      warnings,
    };
  }
  warnings.push(`Unrecognized file ${filename}`);
  return {
    archive: {
      id: archiveId,
      filename,
      importedAt: new Date().toISOString(),
      counts: { ...EMPTY_COUNTS },
      kind: "ytd-file",
    },
    accounts: [],
    relations: [],
    warnings,
  };
}
 