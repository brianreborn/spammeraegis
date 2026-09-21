import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSampleZip } from "./demo.ts";
import { parseArchiveBuffer } from "./parse-zip.ts";

describe("sample zip", () => {
  it("parses the UAT sample archive into blocks and follows", async () => {
    const blob = await buildSampleZip();
    const buf = await blob.arrayBuffer();
    const result = await parseArchiveBuffer(buf, "twitter-2026-08-02-sample.zip");
    const ids = new Set(result.accounts.map((a) => a.id));
    assert.ok(ids.has("10001"));
    assert.ok(ids.has("91001"));
    assert.ok(ids.has("91002"));
    assert.ok(ids.has("92001"));
    assert.ok(result.archive.counts.blocks >= 2);
    assert.ok(result.relations.some((r) => r.type === "block"));
    assert.ok(result.relations.some((r) => r.type === "follow"));
  });
});
