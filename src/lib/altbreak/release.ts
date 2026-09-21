export const APP_NAME = "SpammerAegis";
export const APP_VERSION = "0.1.0";
export const APP_CHANNEL = "alpha" as const;
export const APP_RELEASE = `${APP_VERSION}-${APP_CHANNEL}`;
export const APP_RELEASED = "2026-09-21";

export type RequirementStatus = "ships" | "partial" | "later";

export const REQUIREMENTS: {
  id: string;
  title: string;
  status: RequirementStatus;
  note: string;
}[] = [
  {
    id: "1",
    title: "Find returning alts after a block",
    status: "ships",
    note: "Handle stems, display names, bios, shared follows, co-blocks.",
  },
  {
    id: "2",
    title: "Catch people who will not stop watching",
    status: "ships",
    note: "Desk lists blocked/muted accounts that still follow a case owner. Queue them in one pass.",
  },
  {
    id: "3",
    title: "Action queue with intent links",
    status: "ships",
    note: "Open / copy / done. No silent remote blocks.",
  },
  {
    id: "4",
    title: "Relationship graph",
    status: "ships",
    note: "Force layout: follows in steel, blocks in red. Node opens the dossier.",
  },
  {
    id: "5",
    title: "Field capture without logging in",
    status: "ships",
    note: "Bookmarklet, hash ingest, and Firefox temporary .xpi. Vanadium uses the desk.",
  },
  {
    id: "6",
    title: "Import X archive ZIP offline",
    status: "ships",
    note: "block.js, mute.js, follower.js, following.js, account.js / YTD window.YTD.",
  },
  {
    id: "7",
    title: "Alts from overlap and shared blocks",
    status: "ships",
    note: "Union-find clusters, scored locally against this case.",
  },
  {
    id: "8",
    title: "Export for Gephi and forensics scripts",
    status: "ships",
    note: "nodes/edges CSV, GEXF, twitter-forensics NDJSON ZIP, case JSON, log NDJSON.",
  },
  {
    id: "9",
    title: "Batch-flag from multi-archive patterns",
    status: "ships",
    note: "Flag + queue a cluster, or all clusters. Storage stays on this device.",
  },
  {
    id: "10",
    title: "Live-check handles the way crawl-user.sh did",
    status: "partial",
    note: "Public profile + optional following/posts sample. Full follower dumps still come from imported NDJSON.",
  },
];

export const LIMITS = [
  "Unsigned .xpi loads in standard Firefox only as a Temporary Add-on (gone after restart).",
  "GrapheneOS Vanadium has no extensions. Use this desk plus the bookmarklet.",
  "Live lookup uses a public profile proxy. Rate-limit is conservative; it is not a firehose.",
  "No X login, no remote case store, no auto-block. You confirm every action on X.",
  "Alt scores are evidence, not proof. Review the dossier before you queue.",
];

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "/", action: "Focus search" },
  { keys: "?", action: "About / alpha notes" },
  { keys: "d", action: "Desk" },
  { keys: "i", action: "Import" },
  { keys: "g", action: "Graph" },
  { keys: "a", action: "Alts" },
  { keys: "c", action: "Crawl" },
  { keys: "q", action: "Queue" },
  { keys: "p", action: "Capture" },
  { keys: "e", action: "Export" },
  { keys: "l", action: "Log" },
];

export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "0.1.0-alpha",
    date: APP_RELEASED,
    items: [
      "First cut of the local forensics desk with the Repeat Knock sample case.",
      "ZIP / YTD / twitter-forensics NDJSON import, Gephi + case JSON export.",
      "Alt clustering, watchers, block queue, live-check crawl, Firefox .xpi field kit.",
    ],
  },
];
