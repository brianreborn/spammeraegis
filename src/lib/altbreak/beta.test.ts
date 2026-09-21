import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stemHandle, levenshtein, jaroWinkler, tokenize, jaccard } from "./similarity.ts";
import { findWatchers } from "./watchers.ts";
import { parseCasefileJson, looksLikeCasefile } from "./casefile-json.ts";
import { detectAlts } from "./detect.ts";
import { parseHandles, scoreLiveProfile } from "./live.ts";
import { APP_RELEASE, REQUIREMENTS } from "./release.ts";
import type { Casefile } from "./types.ts";
import { normalizeCasefile } from "./types.ts";

describe("similarity", () => {
  it("stems numbered and reborn handles to the same root", () => {
    assert.equal(stemHandle("voidwatch3"), "voidwatch");
    assert.equal(stemHandle("voidwatchreborn"), "voidwatch");
    assert.equal(stemHandle("realvoidwatch"), "voidwatch");
  });

  it("treats close handles as near", () => {
    assert.equal(levenshtein("voidwatch", "voidwatch3"), 1);
    assert.ok(jaroWinkler("voidwatch", "void_watch") > 0.9);
  });

  it("scores overlapping bios", () => {
    const a = new Set(tokenize("just asking questions"));
    const b = new Set(tokenize("just asking questions still"));
    assert.ok(jaccard(a, b) >= 0.45);
  });
});

describe("watchers", () => {
  it("flags blocked accounts that still follow the case owner", () => {
    const counts = { blocks: 1, mutes: 0, followers: 0, following: 0, tweets: 0, likes: 0, mentions: 0 };
    const cf: Casefile = {
      version: 1,
      name: "t",
      accounts: {
        "1": { id: "1", username: "me", sources: ["a"], blockedIn: [], mutedIn: [] },
        "2": { id: "2", username: "hat", sources: ["a"], blockedIn: ["a"], mutedIn: [] },
        "3": { id: "3", username: "quiet", sources: ["a"], blockedIn: ["a"], mutedIn: [] },
      },
      relations: [{ id: "r", source: "2", target: "1", type: "follow" }],
      archives: [
        {
          id: "a",
          filename: "x.zip",
          accountId: "1",
          importedAt: "2026-09-01T00:00:00.000Z",
          counts,
          kind: "demo",
        },
      ],
      logs: [],
      flags: [],
      queue: [],
      alerts: [],
      notes: {},
      isDemo: true,
    };
    const watchers = findWatchers(cf);
    assert.equal(watchers.length, 1);
    assert.equal(watchers[0]?.accountId, "2");
    assert.equal(watchers[0]?.severity, "high");
  });
});

describe("casefile json", () => {
  it("round-trips a minimal export", () => {
    const raw = {
      version: 1,
      name: "Repeat Knock",
      accounts: { "1": { id: "1", sources: [], blockedIn: [], mutedIn: [] } },
      relations: [],
      archives: [],
      logs: [],
      flags: [],
      queue: [],
      alerts: [],
      notes: {},
      isDemo: true,
    };
    const restored = parseCasefileJson(JSON.stringify(raw));
    assert.equal(restored.name, "Repeat Knock");
    assert.equal(restored.isDemo, false);
    assert.ok(looksLikeCasefile(restored));
    assert.equal(Object.keys(restored.accounts).length, 1);
  });

  it("rejects random json", () => {
    assert.equal(looksLikeCasefile({ id: "1", username: "x" }), false);
    assert.throws(() => parseCasefileJson("{}"));
  });
});

describe("alpha detect + live", () => {
  const counts = { blocks: 2, mutes: 0, followers: 0, following: 0, tweets: 0, likes: 0, mentions: 0 };
  const mini: Casefile = {
    version: 1,
    name: "mini",
    accounts: {
      me: { id: "me", username: "fieldnotes", sources: ["a"], blockedIn: [], mutedIn: [] },
      a: {
        id: "a",
        username: "voidwatch",
        displayName: "Void Watch",
        bio: "just asking questions",
        sources: ["a"],
        blockedIn: ["arc"],
        mutedIn: [],
      },
      b: {
        id: "b",
        username: "voidwatch3",
        displayName: "Void Watch",
        bio: "just asking questions still",
        sources: ["a"],
        blockedIn: [],
        mutedIn: [],
      },
    },
    relations: [
      { id: "r1", source: "a", target: "me", type: "follow" },
      { id: "r2", source: "b", target: "me", type: "follow" },
    ],
    archives: [
      {
        id: "arc",
        filename: "x.zip",
        accountId: "me",
        importedAt: "2026-09-01T00:00:00.000Z",
        counts,
        kind: "demo",
      },
    ],
    logs: [],
    flags: [],
    queue: [],
    alerts: [],
    notes: {},
    isDemo: true,
  };

  it("clusters numbered handle alts", () => {
    const { clusters } = detectAlts(mini);
    assert.ok(clusters.length >= 1);
    const hit = clusters.find((c) => c.memberIds.includes("a") && c.memberIds.includes("b"));
    assert.ok(hit);
    assert.ok((hit?.score ?? 0) >= 42);
  });

  it("flags a live handle that shares a blocked stem", () => {
    const profile = {
      id: "99999",
      username: "voidwatch9",
      displayName: "Void Watch",
      bio: "just asking questions",
      followersCount: 3,
      followingCount: 40,
      tweetsCount: 12,
      likesCount: 0,
      protected: false,
      verified: false,
      defaultAvatar: false,
      createdAt: new Date().toISOString(),
    };
    const hit = scoreLiveProfile(profile, mini);
    assert.ok(hit.score >= 40);
    assert.ok(hit.flags.some((f) => f.code === "handle_stem" || f.code === "handle_near"));
    assert.ok(hit.nearIds.includes("a"));
  });

  it("parses mixed handle paste", () => {
    const got = parseHandles("@voidwatch3\nhttps://x.com/yellow_mocker\n91003\nid:10001");
    assert.ok(got.includes("voidwatch3"));
    assert.ok(got.includes("yellow_mocker"));
    assert.ok(got.includes("id:91003"));
    assert.ok(got.includes("id:10001"));
  });
});

describe("normalizeCasefile", () => {
  it("turns garbage persist payloads into an empty case", () => {
    const cf = normalizeCasefile({ accounts: null, alerts: undefined });
    assert.deepEqual(cf.alerts, []);
    assert.deepEqual(cf.relations, []);
    assert.equal(Object.keys(cf.accounts).length, 0);
    assert.doesNotThrow(() => detectAlts(cf));
  });
});

describe("release", () => {
  it("ships an alpha channel string and requirement list", () => {
    assert.match(APP_RELEASE, /alpha/);
    assert.ok(REQUIREMENTS.length >= 10);
    assert.ok(REQUIREMENTS.some((r) => r.status === "ships"));
  });
});
