import type { Casefile } from "./types";
import { emptyCasefile } from "./types";

export function looksLikeCasefile(value: unknown): value is Casefile {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.version === 1 &&
    typeof obj.accounts === "object" &&
    obj.accounts !== null &&
    !Array.isArray(obj.accounts) &&
    Array.isArray(obj.archives)
  );
}

export function parseCasefileJson(text: string): Casefile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not JSON");
  }
  if (!looksLikeCasefile(parsed)) throw new Error("Not a SpammerAegis casefile");
  const base = emptyCasefile();
  return {
    ...base,
    ...parsed,
    version: 1,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "Restored case",
    accounts: parsed.accounts ?? {},
    relations: Array.isArray(parsed.relations) ? parsed.relations : [],
    archives: Array.isArray(parsed.archives) ? parsed.archives : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    isDemo: false,
  };
}
