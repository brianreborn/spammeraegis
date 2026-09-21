/**
 * Export matching twitter-forensics gephi-digest.py:
 *   Nodes(id, label, node_size = log(followers))
 *   Edges(source, target, weight = log(followers of source))
 * plus GEXF and inspector NDJSON for the original scripts.
 */

import type { Account, Casefile, Relation } from "./types";
import { csvEscape, downloadBlob, downloadText, handleOf } from "@/lib/utils";

function nodeSize(acc?: Account): number {
  const n = acc?.followersCount ?? 0;
  return n > 1 ? Math.log(n) : 0;
}

function labelOf(acc: Account | undefined, id: string): string {
  if (!acc) return id;
  return acc.username ?? acc.displayName ?? id;
}

export function gephiNodesCsv(cf: Casefile): string {
  const header = "Id,Label,node_size,blocked,muted,flagged,username";
  const flagged = new Set(cf.flags.map((f) => f.accountId));
  const lines = Object.values(cf.accounts).map((acc) =>
    [
      csvEscape(acc.id),
      csvEscape(labelOf(acc, acc.id)),
      csvEscape(nodeSize(acc).toFixed(4)),
      csvEscape(acc.blockedIn.length ? 1 : 0),
      csvEscape(acc.mutedIn.length ? 1 : 0),
      csvEscape(flagged.has(acc.id) ? 1 : 0),
      csvEscape(acc.username ?? ""),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function gephiEdgesCsv(cf: Casefile): string {
  const header = "Source,Target,Weight,Type";
  const unique = new Map<string, Relation>();
  for (const r of cf.relations) {
    unique.set(`${r.source}|${r.target}|${r.type}`, r);
  }
  const lines = [...unique.values()].map((r) => {
    const src = cf.accounts[r.source];
    const weight = r.type === "follow" ? nodeSize(src) : 1;
    return [csvEscape(r.source), csvEscape(r.target), csvEscape(weight.toFixed(4)), csvEscape(r.type)].join(",");
  });
  return [header, ...lines].join("\n");
}

export function gephiGexf(cf: Casefile): string {
  const flagged = new Set(cf.flags.map((f) => f.accountId));
  const nodes = Object.values(cf.accounts)
    .map((acc) => {
      const l = escapeXml(labelOf(acc, acc.id));
      return `      <node id="${escapeXml(acc.id)}" label="${l}">
        <attvalues>
          <attvalue for="blocked" value="${acc.blockedIn.length ? 1 : 0}"/>
          <attvalue for="muted" value="${acc.mutedIn.length ? 1 : 0}"/>
          <attvalue for="flagged" value="${flagged.has(acc.id) ? 1 : 0}"/>
          <attvalue for="node_size" value="${nodeSize(acc).toFixed(4)}"/>
        </attvalues>
      </node>`;
    })
    .join("\n");
  const unique = new Map<string, Relation>();
  for (const r of cf.relations) unique.set(`${r.source}|${r.target}|${r.type}`, r);
  const edges = [...unique.values()]
    .map((r, i) => {
      const w = r.type === "follow" ? nodeSize(cf.accounts[r.source]) : 1;
      return `      <edge id="${i}" source="${escapeXml(r.source)}" target="${escapeXml(r.target)}" weight="${w.toFixed(4)}" kind="${r.type}"/>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.2" version="1.2">
  <meta>
    <creator>SpammerAegis</creator>
    <description>${escapeXml(cf.name)} — twitter-forensics compatible</description>
  </meta>
  <graph defaultedgetype="directed" mode="static">
    <attributes class="node">
      <attribute id="blocked" title="blocked" type="integer"/>
      <attribute id="muted" title="muted" type="integer"/>
      <attribute id="flagged" title="flagged" type="integer"/>
      <attribute id="node_size" title="node_size" type="float"/>
    </attributes>
    <nodes>
${nodes}
    </nodes>
    <edges>
${edges}
    </edges>
  </graph>
</gexf>
`;
}

function escapeXml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function blocklistText(cf: Casefile): string {
  const ids = new Set<string>();
  for (const acc of Object.values(cf.accounts)) {
    if (acc.blockedIn.length || cf.queue.some((q) => q.accountId === acc.id && q.status !== "done")) {
      ids.add(acc.id);
    }
  }
  const lines = [...ids].map((id) => {
    const acc = cf.accounts[id]!;
    return [acc.id, acc.username ?? "", a
... 