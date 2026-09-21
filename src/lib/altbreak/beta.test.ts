import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stemHandle, levenshtein, jaroWinkler, tokenize, jaccard } from "./similarity.ts";
import { findWatchers } from "./watchers.ts";
import { parseCasefileJson, looksLikeCasefile } from "./casefile-json.ts";
import { detectAlts } from "./detect.ts";
import { buildDemoCase } from "./demo.ts";
import { parseHandles, profileFromAccount, scoreLiveProfile } from "./live.ts";
import { APP_RELEASE, REQUIREMENTS } from "./release.ts";
import type { Casefile } from "./types.ts";

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
  it("clusters the Repeat Knock voidwatch ring", () => {
    const { clusters } = detectAlts(buildDemoCase());
    assert.ok(clusters.length >= 1);
    const voidish = clusters.find((c) =>
      c.memberIds.some((id) => buildDemoCase().accounts[id]?.username?.startsWith("void")),
    );
    assert.ok(voidish);
    assert.ok((voidish?.score ?? 0) >= 42);
    assert.ok(voidish?.evidence.some((e) => e.kind === "handle" || e.kind === "bio"));
  });

  it("flags a live handle that shares a blocked stem", () => {
    const cf = buildDemoCase();
    const seed = cf.accounts["91001"]!;
    const profile = {
      ...profileFromAccount(seed),
      id: "99999",
      username: "voidwatch9",
      displayName: "Void Watch",
      bio: "just asking questions",
    };
    const hit = scoreLiveProfile(profile, cf);
    assert.ok(hit.score >= 40);
    assert.ok(hit.flags
... 