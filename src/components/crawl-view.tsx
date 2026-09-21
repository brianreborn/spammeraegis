import { useMemo, useState } from "react";
import { Radar, ScanSearch, ShieldAlert, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { crawlProfiles } from "@/lib/altbreak/crawl.functions";
import {
  hitFromProfile,
  parseHandles,
  profileFromAccount,
  type LiveHit,
} from "@/lib/altbreak/live";
import { downloadBlob, formatInt, formatWhen, handleOf, xIntentUserUrl } from "@/lib/utils";
import { downloadFieldKitXpi } from "@/lib/altbreak/field-kit";
import { useCasefile } from "@/store/casefile";
import { toast } from "sonner";

export function CrawlView() {
  const cf = useCasefile((s) => s.cf);
  const ingestLive = useCasefile((s) => s.ingestLive);
  const [text, setText] = useState("");
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<LiveHit[]>([]);

  const blockedHandles = useMemo(
    () =>
      Object.values(cf.accounts)
        .filter((a) => a.blockedIn.length && a.username)
        .slice(0, 8)
        .map((a) => a.username!)
        .join("\n"),
    [cf.accounts],
  );

  async function runLive() {
    const handles = parseHandles(text);
    if (!handles.length) {
      toast.error("Paste @handles or profile URLs first");
      return;
    }
    setBusy(true);
    try {
      const { results } = await crawlProfiles({ data: { handles: handles.slice(0, 8), deep } });
      const next: LiveHit[] = results.map((r) => {
        if (!r.ok || !r.profile) {
          return {
            query: r.query,
            ok: false,
            error: r.error ?? "No profile",
            source: "live" as const,
            flags: [],
            score: 0,
            nearIds: [],
          };
        }
        return hitFromProfile(r.query, r.profile, useCasefile.getState().cf, "live", {
          following: r.following,
          statuses: r.statuses,
        });
      });
      setHits(next);
      const odd = next.filter((h) => h.ok && h.score >= 40).length;
      toast.success(`Looked up ${next.length} · ${odd} look odd vs this case`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Live lookup failed");
    } finally {
      setBusy(false);
    }
  }

  function runLocalPass() {
    const wanted = parseHandles(text);
    const pool = Object.values(cf.accounts).filter((a) => {
      if (!a.username) return false;
      if (wanted.length) return wanted.some((h) => h.replace(/^id:/, "") === a.username?.toLowerCase() || h === a.id);
      return a.blockedIn.length > 0 || Boolean(a.capturedAt);
    });
    const next = pool.slice(0, 24).map((a) => hitFromProfile(a.username ?? a.id, profileFromAccount(a), cf, "local"));
    next.sort((a, b) => b.score - a.score);
    setHits(next);
    toast.success(`Oddity pass on ${next.length} loaded accounts (no network)`);
  }

  async function runQueueLive() {
    const handles = cf.queue
      .filter((q) => q.status !== "done")
      .map((q) => cf.accounts[q.accountId]?.username)
      .filter((h): h is string => Boolean(h));
    if (!handles.length) {
      toast.error("Open queue has no handles to look up");
      return;
    }
    setText(handles.join("\n"));
    setBusy(true);
    try {
      const { results } = await crawlProfiles({ data: { handles: handles.slice(0, 8), deep } });
      const next: LiveHit[] = results.map((r) => {
        if (!r.ok || !r.profile) {
          return {
            query: r.query,
            ok: false,
            error: r.error ?? "No profile",
            source: "live" as const,
            flags: [],
            score: 0,
            nearIds: [],
          };
        }
        return hitFromProfile(r.query, r.profile, useCasefile.getState().cf, "live", {
          following: r.following,
          statuses: r.statuses,
        });
      });
      setHits(next);
      toast.success(`Queue live-check: ${next.length}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Queue lookup failed");
    } finally {
      setBusy(false);
    }
... 