import type { Account, ArchiveMeta, Casefile, Relation } from "./types";
import { uid } from "@/lib/utils";

function acc(
  id: string,
  username: string,
  displayName: string,
  bio: string,
  extra: Partial<Account> = {},
): Account {
  return {
    id,
    username,
    displayName,
    bio,
    sources: extra.sources ?? ["demo"],
    blockedIn: extra.blockedIn ?? [],
    mutedIn: extra.mutedIn ?? [],
    createdAt: extra.createdAt,
    followersCount: extra.followersCount,
    followingCount: extra.followingCount,
    capturedAt: extra.capturedAt,
  };
}

function rel(source: string, target: string, type: Relation["type"], archiveId: string): Relation {
  return { id: uid("rel"), source, target, type, archiveId };
}

/** One-click sample case: two archives, a returning-alt ring, shared blocks. */
export function buildDemoCase(): Casefile {
  const a1 = "arc_field_2026_08";
  const a2 = "arc_watch_2026_09";
  const owner = "10001";
  const ally = "10002";

  const archives: ArchiveMeta[] = [
    {
      id: a1,
      filename: "twitter-2026-08-02-a1b2c3.zip",
      date: "2026-08-02",
      accountId: owner,
      username: "fieldnotes",
      displayName: "Field Notes",
      bio: "Public notes. Blocks are not a suggestion.",
      importedAt: "2026-08-02T18:00:00.000Z",
      counts: { blocks: 11, mutes: 3, followers: 14, following: 8, tweets: 6, likes: 0, mentions: 6 },
      kind: "demo",
    },
    {
      id: a2,
      filename: "twitter-2026-09-14-d4e5f6.zip",
      date: "2026-09-14",
      accountId: ally,
      username: "watchdesk",
      displayName: "Watch Desk",
      bio: "Ally archive. Shared the same knockers.",
      importedAt: "2026-09-14T12:00:00.000Z",
      counts: { blocks: 6, mutes: 1, followers: 8, following: 6, tweets: 0, likes: 0, mentions: 0 },
      kind: "demo",
    },
  ];

  const hubs = [
    acc("88001", "signalboard", "Signal Board", "link in bio", { followersCount: 84000 }),
    acc("88002", "nightcircuit", "Night Circuit", "ask questions", { followersCount: 22100 }),
    acc("88003", "opendossier", "Open Dossier", "public records", { followersCount: 5600 }),
  ];

  const voidWatch = [
    acc("91001", "voidwatch", "Void Watch", "just asking questions", {
      blockedIn: [a1, a2],
      createdAt: "2024-11-02",
      followersCount: 412,
      sources: [a1, a2],
    }),
    acc("91002", "voidwatch3", "Void Watch", "just asking questions", {
      blockedIn: [a1],
      createdAt: "2026-08-04",
      followersCount: 19,
      sources: [a1],
    }),
    acc("91003", "void_watch", "VoidWatch", "just asking questions.", {
      createdAt: "2026-08-05",
      followersCount: 8,
      capturedAt: "2026-08-06T04:12:00.000Z",
      sources: ["capture"],
    }),
    acc("91004", "voidwatch_alt", "VW", "asking questions still", {
      createdAt: "2026-08-07",
      followersCount: 4,
      capturedAt: "2026-08-08T16:40:00.000Z",
      sources: ["capture"],
    }),
    acc("91005", "voidwatchreborn", "Void Watch Reborn", "you can't silence questions", {
      blockedIn: [a2],
      createdAt: "2026-08-18",
      followersCount: 27,
      sources: [a2],
    }),
    acc("91006", "realvoidwatch", "The Real Void Watch", "just asking questions", {
      createdAt: "2026-09-01",
      followersCount: 11,
      capturedAt: "2026-09-02T09:00:00.000Z",
      sources: ["capture"],
    }),
    acc("91007", "voidwatchhq", "VoidWatch HQ", "official questions", {
      createdAt: "2026-09-12",
      followersCount: 6,
      sources: [a1],
    }),
  ];

  const mockers = [
    acc("92001", "yellowmock", "Yellow Mock", "harmless parody", {
      blockedIn: [a1],
      createdAt: "2025-04-11",
      followersCount: 88,
      sources: [a1],
    }),
    acc("92002", "yellow_mocker", "Yellow Mocker", "harmless parody account", {
      createdAt: "2026-07-22",
      followersCount: 14,
      capturedAt: "2026-08-01T11:00:00.000Z",
      sources: ["capture"],
    }),
    acc("92003", "yellowmock2", "YM2", "parody. harmless.", {
      blockedIn: [a2],
      createdAt: "2026-08-20",
      followersCount: 9,
      sources: [a2],
    }),
  ];

  const owners = [
    acc(owner, "fieldnotes", "Field Notes", "Public notes. Blocks are not a suggestion.", {
      sources: [a1],
      followersCount: 640,
    }),
    acc(ally, "watchdesk", "Watch Desk", "Ally archive. Shared the same knockers.", {
      sources: [a2],
      followersCount: 210,
    }),
  ];

  const accounts: Record<string, Account> = {};
  for (const a of [...owners, ...hubs, ...voidWatch, ...mockers]) accounts[a.id] = a;

  const relations: Relation[] = [];
  for (const v of voidWatch) {
    relations.push(rel(v.id, owner, "follow", a1));
    for (const h of hubs) relations.push(rel(v.id, h.id, "follow", a1));
  }
  for (const m of mockers) {
    relations.push(rel(m.id, owner, "follow", a1));
    relations.push(rel(m.id, hubs[0]!.id, "follow", a1));
    relations.push(rel(m.id, hubs[1]!.id, "follow", a1));
  }
  for (const v of voidWatch.filter((x) => x.blockedIn.length)) {
    relations.push(rel(owner, v.id, "block", v.blockedIn[0] ?? a1));
  }

  return {
    version: 1,
    name: "Repeat Knock",
    accounts,
    relations,
    archives,
    logs: [
      {
        id: "log_demo",
        at: "2026-09-14T12:00:00.000Z",
        kind: "import",
        message: "Loaded Repeat Knock sample case.",
      },
    ],
    flags: [],
    queue: [],
    alerts: [],
    notes: {},
    isDemo: true,
  };
}

export async function buildSampleZip(): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(
    "data/account.js",
    `window.YTD.account.part0 = ${JSON.stringify([{ account: { accountId: "10001", username: "fieldnotes", accountDisplayName: "Field Notes" } }])};`,
  );
  zip.file(
    "data/block.js",
    `window.YTD.block.part0 = ${JSON.stringify([{ blocking: { accountId: "91001" } }, { blocking: { accountId: "91002" } }])};`,
  );
  zip.file(
    "data/following.js",
    `window.YTD.following.part0 = ${JSON.stringify([{ following: { accountId: "88001" } }])};`,
  );
  return zip.generateAsync({ type: "blob" });
}
 