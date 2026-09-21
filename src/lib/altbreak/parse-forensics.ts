/**
 * twitter-forensics inspector format:
 *   @username/user.json, followers.json, following.json
 * each file is newline-delimited JSON (one user object per line).
 * Fields observed in gephi-ingest.py: id, username, displayname, created, followersCount.
 */

import type { Account, Relation } from "./types";
import { nested, str } from "./parse-ytd";
import { uid } from "@/lib/utils";

export type ForensicsUser = {
  id: string;
  username?: string;
  displayName?: string;
  created?: string;
  followersCount?: number;
  followingCount?: number;
  bio?: string;
};

export function parseNdjson(text: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return rows;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
      }
    } catch {
      /* fall through to line mode */
    }
  }
  for (const line of trimmed.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      const obj = JSON.parse(s) as unknown;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        rows.push(obj as Record<string, unknown>);
      }
    } catch {
      /* skip broken fragment, same as gephi-ingest.py */
    }
  }
  return rows;
}

export function userFromFragment(row: Record<string, unknown>): ForensicsUser | null {
  const inner = nested(row, "user") ?? row;
  const id = str(inner.id_str) ?? str(inner.id) ?? str(inner.rest_id);
  if (!id) return null;
  const followers =
    typeof inner.followersCount === "number"
      ? inner.followersCount
      : typeof inner.followers_count === "number"
        ? inner.followers_count
        : undefined;
  const following =
    typeof inner.friendsCount === "number"
      ? inner.friendsCount
      : typeof inner.friends_count === "number"
        ? inner.friends_count
        : typeof inner.followingCount === "number"
          ? inner.followingCount
          : undefined;
  const bio =
    str(inner.rawDescription) ??
    str(inner.description) ??
    str(inner.bio);
  return {
    id,
    username: str(inner.username) ?? str(inner.screen_name),
    displayName: str(inner.displayname) ?? str(inner.display_name) ?? str(inner.name),
    created: str(inner.created) ?? str(inner.created_at),
    followersCount: followers,
    followingCount: following,
    bio,
  };
}

export function accountFromForensics(user: ForensicsUser, source: string): Account {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    createdAt: user.created,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    sources: [source],
    blockedIn: [],
    mutedIn: [],
  };
}

export function followRelations(
  owner: ForensicsUser,
  others: ForensicsUser[],
  kind: "followers" | "following",
  archiveId: string,
): Relation[] {
  return others.map((other) => ({
    id: uid("rel"),
    source: kind === "followers" ? other.id : owner.id,
    target: kind === "followers" ? owner.id : other.id,
    type: "follow" as const,
    archiveId,
  }));
}
