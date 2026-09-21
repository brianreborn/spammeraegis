import type { LiveNeighbor, LiveProfile, LiveStatus } from "./live";

const FX = "https://api.fxtwitter.com";
const UA = "Mozilla/5.0 (compatible; SpammerAegis/1.0; local forensics desk)";

type FxUser = {
  id?: string;
  screen_name?: string;
  name?: string;
  description?: string;
  joined?: string;
  followers?: number;
  following?: number;
  likes?: number;
  statuses?: number;
  protected?: boolean;
  avatar_url?: string | null;
  banner_url?: string | null;
  location?: string;
  website?: { url?: string; display_url?: string };
  verification?: { verified?: boolean };
};

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function isoJoined(raw?: string): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function mapUser(u: FxUser): LiveProfile | null {
  const id = u.id ? String(u.id) : "";
  const username = u.screen_name?.trim();
  if (!id || !username) return null;
  const avatar = u.avatar_url ?? undefined;
  const defaultAvatar = !avatar || /default_profile/i.test(avatar);
  return {
    id,
    username,
    displayName: u.name?.trim() || username,
    bio: u.description ?? "",
    createdAt: isoJoined(u.joined),
    followersCount: asNum(u.followers),
    followingCount: asNum(u.following),
    tweetsCount: asNum(u.statuses),
    likesCount: asNum(u.likes),
    protected: Boolean(u.protected),
    verified: Boolean(u.verification?.verified),
    defaultAvatar,
    avatarUrl: avatar ?? undefined,
    website: u.website?.display_url ?? u.website?.url,
    location: u.location || undefined,
  };
}

async function fxGet(path: string, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${FX}${path}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`lookup ${res.status}`);
    }
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(t);
  }
}

function usersFromList(data: unknown): LiveNeighbor[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: LiveNeighbor[] = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const p = mapUser(row as FxUser);
    if (!p) continue;
    out.push({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      bio: p.bio,
      followersCount: p.followersCount,
      followingCount: p.followingCount,
    });
  }
  return out;
}

function statusesFromList(data: unknown): LiveStatus[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const out: LiveStatus[] = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const r = row as { id?: string; text?: string; created_at?: string };
    if (!r.id || !r.text) continue;
    out.push({ id: String(r.id), text: r.text, createdAt: isoJoined(r.created_at) });
  }
  return out;
}

export type CrawlFetch = {
  query: string;
  ok: boolean;
  error?: string;
  profile?: LiveProfile;
  following?: LiveNeighbor[];
  statuses?: LiveStatus[];
};

export async function fetchPublicUser(query: string, deep: boolean): Promise<CrawlFetch> {
  const pathId = encodeURIComponent(query);
  try {
    let data: unknown;
    try {
      data = await fxGet(`/2/profile/${pathId}`);
    } catch {
      data = await fxGet(`/${pathId}`);
    }
    const user = data && typeof data === "object" ? (data as { user?: FxUser }).user : undefined;
    const profile = user ? mapUser(user) : null;
    if (!profile) {
      return { query, ok: false, error: "No public profile (suspended, missing, or private to this lookup)." };
    }
    let following: LiveNeighbor
... 