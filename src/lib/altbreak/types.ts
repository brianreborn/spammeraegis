export type RelationType = "follow" | "block" | "mute" | "mention" | "reply";

export type ArchiveKind = "x-archive" | "forensics" | "ytd-file" | "capture" | "demo" | "crawl";

export type Account = {
  id: string;
  username?: string;
  displayName?: string;
  bio?: string;
  createdAt?: string;
  followersCount?: number;
  followingCount?: number;
  tweetsCount?: number;
  likesCount?: number;
  protected?: boolean;
  verified?: boolean;
  avatarUrl?: string;
  website?: string;
  location?: string;
  sources: string[];
  blockedIn: string[];
  mutedIn: string[];
  capturedAt?: string;
};

export type Relation = {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  archiveId?: string;
};

export type ArchiveCounts = {
  blocks: number;
  mutes: number;
  followers: number;
  following: number;
  tweets: number;
  likes: number;
  mentions: number;
};

export type ArchiveMeta = {
  id: string;
  filename: string;
  date?: string;
  accountId?: string;
  username?: string;
  displayName?: string;
  bio?: string;
  importedAt: string;
  counts: ArchiveCounts;
  kind: ArchiveKind;
};

export type LogKind =
  | "block"
  | "mute"
  | "flag"
  | "alert"
  | "import"
  | "capture"
  | "crawl"
  | "export"
  | "note"
  | "queue";

export type LogEntry = {
  id: string;
  at: string;
  kind: LogKind;
  accountId?: string;
  archiveId?: string;
  message: string;
};

export type Flag = {
  id: string;
  accountId: string;
  clusterId: string;
  score: number;
  reasons: string[];
  at: string;
  batch: boolean;
};

export type QueueStatus = "open" | "copied" | "done";

export type QueueItem = {
  id: string;
  accountId: string;
  reason: string;
  status: QueueStatus;
  addedAt: string;
};

export type AlertSeverity = "high" | "medium" | "low";

export type Alert = {
  id: string;
  at: string;
  title: string;
  detail: string;
  accountIds: string[];
  severity: AlertSeverity;
  read: boolean;
};

export type Casefile = {
  version: 1;
  name: string;
  accounts: Record<string, Account>;
  relations: Relation[];
  archives: ArchiveMeta[];
  logs: LogEntry[];
  flags: Flag[];
  queue: QueueItem[];
  alerts: Alert[];
  notes: Record<string, string>;
  isDemo: boolean;
};

export type Evidence = {
  kind:
    | "handle"
    | "display"
    | "bio"
    | "follows"
    | "blocks"
    | "created"
    | "watch"
    | "live";
  detail: string;
  weight: number;
};

export type PairHit = {
  a: string;
  b: string;
  score: number;
  evidence: Evidence[];
};

export type AltCluster = {
  id: string;
  memberIds: string[];
  score: number;
  evidence: Evidence[];
  sharedFollows: string[];
  sharedBlockArchives: string[];
};

export type UnfollowRow = {
  accountId: string;
  seenOn: string[];
  stillFollowing: boolean;
};

export type ImportResult = {
  archive: ArchiveMeta;
  accounts: Account[];
  relations: Relation[];
  warnings: string[];
};

export const EMPTY_COUNTS: ArchiveCounts = {
  blocks: 0,
  mutes: 0,
  followers: 0,
  following: 0,
  tweets: 0,
  likes: 0,
  mentions: 0,
};

export function emptyCasefile(): Casefile {
  return {
    version: 1,
    name: "Untitled case",
    accounts: {},
    relations: [],
    archives: [],
    logs: [],
    flags: [],
    queue: [],
    alerts: [],
    notes: {},
    isDemo: false,
  };
}

/** Guard persisted / imported payloads so the desk cannot boot into a white screen. */
export function normalizeCasefile(raw: unknown): Casefile {
  const base = emptyCasefile();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<Casefile>;
  const accounts: Record<string, Account> = {};
  const src = o.accounts && typeof o.accounts === "object" ? o.accounts : {};
  for (const [id, acc] of Object.entries(src)) {
    if (!acc || typeof acc !== "object") continue;
    accounts[id] = {
      id: acc.id || id,
      username: acc.username,
      displayName: acc.displayName,
      bio: acc.bio,
      createdAt: acc.createdAt,
      followersCount: acc.followersCount,
      followingCount: acc.followingCount,
      tweetsCount: acc.tweetsCount,
      likesCount: acc.likesCount,
      protected: acc.protected,
      verified: acc.verified,
      avatarUrl: acc.avatarUrl,
      website: acc.website,
      location: acc.location,
      sources: Array.isArray(acc.sources) ? acc.sources : [],
      blockedIn: Array.isArray(acc.blockedIn) ? acc.blockedIn : [],
      mutedIn: Array.isArray(acc.mutedIn) ? acc.mutedIn : [],
      capturedAt: acc.capturedAt,
    };
  }
  return {
    version: 1,
    name: typeof o.name === "string" && o.name.trim() ? o.name : base.name,
    accounts,
    relations: Array.isArray(o.relations) ? o.relations : [],
    archives: Array.isArray(o.archives) ? o.archives : [],
    logs: Array.isArray(o.logs) ? o.logs : [],
    flags: Array.isArray(o.flags) ? o.flags : [],
    queue: Array.isArray(o.queue) ? o.queue : [],
    alerts: Array.isArray(o.alerts) ? o.alerts : [],
    notes: o.notes && typeof o.notes === "object" ? o.notes : {},
    isDemo: Boolean(o.isDemo),
  };
}
