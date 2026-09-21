import type { Account, ArchiveMeta, ImportResult, Relation } from "./types";
import { EMPTY_COUNTS } from "./types";
import {
  archiveDateFromFilename,
  parseAccountFile,
  parseIdList,
  parseProfileBio,
  parseTweetInteractions,
} from "./parse-ytd";
import {
  accountFromForensics,
  followRelations,
  parseNdjson,
  userFromFragment,
  type ForensicsUser,
} from "./parse-forensics";
import { uid } from "@/lib/utils";

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

... 