import type { Account, Casefile } from "./types.ts";
import { jaccard, jaroWinkler, levenshtein, stemHandle, tokenize } from "./similarity.ts";

export type LiveProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  createdAt?: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  likesCount: number;
  protected: boolean;
  verified: boolean;
  defaultAvatar: boolean;
  avatarUrl?: string;
  website?: string;
  location?: string;
};

export type LiveNeighbor = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  followersCount: number;
  followingCount: number;
};

export type LiveStatus = {
  id: string;
  text: string;
  createdAt?: string;
};

export type OddFlag = {
  code: string;
  label: string;
  detail: string;
  weight: number;
};

export type LiveHit = {
  query: string;
  ok: boolean;
  error?: string;
  source: "live" | "local" | "extension";
  profile?: LiveProfile;
  following?: LiveNeighbor[];
  statuses?: LiveStatus[];
  flags: OddFlag[];
  score: number;
  nearIds: string[];
};

export function parseHandles(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    let t = raw.trim();
    if (!t) continue;
    t = t.replace(/^@/, "");
    t = t.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
    t = t.split(/[/?#]/)[0] ?? t;
    t = t.trim();
    if (/^id:\d{5,}$/i.test(t)) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
      continue;
    }
    if (/^\d{5,}$/.test(t)) {
      const key = `id:${t}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
      continue;
    }
    if (/^[A-Za-z0-9_]{1,15}$/.test(t)) {
      const key = t;
      if (!seen.has(key.toLowerCase())) {
        seen.add(key.toLowerCase());
        out.push(key);
      }
    }
  }
  return out.slice(0, 24);
}

export function profileFromAccount(a: Account): LiveProfile {
  return {
    id: a.id,
    username: a.username ?? a.id,
    displayName: a.displayName ?? a.username ?? a.id,
    bio: a.bio ?? "",
    createdAt: a.createdAt,
    followersCount: a.followersCount ?? 0,
    followingCount: a.followingCount ?? 0,
    tweetsCount: a.tweetsCount ?? 0,
    likesCount: a.likesCount ?? 0,
    protected: Boolean(a.protected),
    verified: Boolean(a.verified),
    defaultAvatar: Boolean(a.avatarUrl && /default_profile/i.test(a.avatarUrl)),
    avatarUrl: a.avatarUrl,
    website: a.website,
    location: a.location,
  };
}

export function accountFromProfile(p: LiveProfile, source: string, at: string): Account {
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    createdAt: p.createdAt,
    followersCount: p.followersCount,
    followingCount: p.followingCount,
    tweetsCount: p.tweetsCount,
    likesCount: p.likesCount,
    protected: p.protected,
    verified: p.verified,
    avatarUrl: p.avatarUrl,
    website: p.website,
    location: p.location,
    sources: [source],
    blockedIn: [],
    mutedIn: [],
    capturedAt: at,
  };
}

function ageDays(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return undefined;
  return Math.max(0, (Date.now() - t) / 86400000);
}

export function scoreLiveProfile(profile: LiveProfile, cf: Casefile): Pick<LiveHit, "flags" | "score" | "nearIds"> {
  const flags: OddFlag[] = [];
  const near = new Map<string, number>();
  const bump = (id: string, w: number) => near.set(id, Math.max(near.get(id) ?? 0, w));

  const blocked = Object.values(cf.accounts).filter((a) => a.blockedIn.length || a.mutedIn.length);
  const handle = profile.username.toLowerCase();
  const stem = stemHandle(handle);
  const display = profile.displayName.toLowerCase().replace(/\s+/g, " ").trim();
  const bioTok = tokenize(profile.bio);

  for (const other of blocked) {
    if (other.id === profile.id) {
      flags.push({
        code: "already_blocked",
        label: "Already blocked",
... 