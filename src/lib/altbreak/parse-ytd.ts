/**
 * Parse official X/Twitter archive `window.YTD.*.partN = …` JavaScript files.
 * Mirrors twitter-archive-tools: `zip_file.read("data/#{step}.js").split(' = ', 2)[1]`.
 */

export function parseYtdPayload(text: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, "");
  const splitAt = trimmed.indexOf(" = ");
  const jsonText =
    splitAt >= 0
      ? trimmed.slice(splitAt + 3).trim().replace(/;\s*$/, "")
      : trimmed.slice(Math.max(0, trimmed.indexOf("["))).trim().replace(/;\s*$/, "");
  if (!jsonText) return [];
  return JSON.parse(jsonText);
}

export function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
}

export function nested(row: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const inner = row[key];
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return null;
}

export function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

export function idOf(
  row: Record<string, unknown>,
  nestedKey?: string,
): string | undefined {
  const inner = nestedKey ? nested(row, nestedKey) : row;
  const src = inner ?? row;
  return (
    str(src.accountId) ??
    str(src.id_str) ??
    str(src.id) ??
    str(src.userId) ??
    undefined
  );
}

export type YtdAccount = {
  accountId?: string;
  username?: string;
  displayName?: string;
  createdAt?: string;
  email?: string;
};

export function parseAccountFile(text: string): YtdAccount | null {
  const rows = asArray(parseYtdPayload(text));
  for (const row of rows) {
    const acc = nested(row, "account") ?? row;
    const accountId = str(acc.accountId) ?? str(acc.id);
    if (!accountId && !str(acc.username)) continue;
    return {
      accountId,
      username: str(acc.username),
      displayName: str(acc.accountDisplayName) ?? str(acc.displayName),
      createdAt: str(acc.createdAt),
      email: str(acc.email),
    };
  }
  return null;
}

export function parseProfileBio(text: string): string | undefined {
  const rows = asArray(parseYtdPayload(text));
  for (const row of rows) {
    const profile = nested(row, "profile") ?? row;
    const desc = nested(profile, "description");
    const bio = str(desc?.bio) ?? str(profile.bio) ?? str(profile.description);
    if (bio) return bio;
  }
  return undefined;
}

export function parseIdList(text: string, nestedKey: string): string[] {
  const rows = asArray(parseYtdPayload(text));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = idOf(row, nestedKey) ?? idOf(row);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export type MentionHit = {
  targetId?: string;
  targetUsername?: string;
  kind: "mention" | "reply";
};

export function parseTweetInteractions(text: string, ownerId?: string): MentionHit[] {
  const rows = asArray(parseYtdPayload(text));
  const hits: MentionHit[] = [];
  for (const row of rows) {
    const tweet = nested(row, "tweet") ?? row;
    const replyId = str(tweet.in_reply_to_user_id_str) ?? str(tweet.in_reply_to_user_id);
    if (replyId && replyId !== ownerId) {
      hits.push({
        targetId: replyId,
        targetUsername: str(tweet.in_reply_to_screen_name),
        kind: "reply",
      });
    }
    const entities = nested(tweet, "entities");
    const mentions = entities?.user_mentions;
    if (Array.isArray(mentions)) {
      for (const m of mentions) {
        if (!m || typeof m !== "object") continue;
        const rec = m as Record<string, unknown>;
        const mid = str(rec.id_str) ?? str(rec.id);
        const name = str(rec.screen_name);
        if ((mid && mid !== ownerId) || name) {
          hits.push({ targetId: mid, targetUsername: name, kind: "mention" });
        }
      }
    }
  }
  return hits;
}

export function archiveDateFromFilename(filename: string): { date?: string } {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return { date: m?.[1] };
}
 