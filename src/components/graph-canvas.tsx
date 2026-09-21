import { useEffect, useRef } from "react";
import { useCasefile } from "@/store/casefile";

type Node = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  label: string;
};

export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cf = useCasefile((s) => s.cf);
  const clusters = useCasefile((s) => s.clusters);
  const selectedId = useCasefile((s) => s.selectedId);
  const select = useCasefile((s) => s.select);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const flagged = new Set(cf.flags.map((f) => f.accountId));
    const inAlt = new Set(clusters.flatMap((c) => c.memberIds));
    const ownerIds = new Set(cf.archives.map((a) => a.accountId).filter(Boolean) as string[]);

    const accounts = Object.values(cf.accounts);
    const nodes: Node[] = accounts.map((acc, i) => {
      const n = accounts.length;
      const ang = (i / Math.max(n, 1)) * Math.PI * 2;
      let color = "#6a6e76";
      if (ownerIds.has(acc.id)) color = "#b8c4ce";
      else if (acc.blockedIn.length) color = "#c45c4a";
      else if (inAlt.has(acc.id) || flagged.has(acc.id)) color = "#b08948";
      else if (acc.mutedIn.length) color = "#8a8e96";
      return {
        id: acc.id,
        x: Math.cos(ang) * 180,
        y: Math.sin(ang) * 140,
        vx: 0,
        vy: 0,
        r: ownerIds.has(acc.id) ? 9 : acc.blockedIn.length ? 6.5 : 5,
        color,
        label: acc.username ? `@${acc.username}` : acc.id.slice(0, 8),
      };
    });
    const index = new Map(nodes.map((n) => [n.id, n]));
    const edges = cf.relations
      .filter((r) => index.has(r.source) && index.has(r.target))
      .map((r) => ({
        a: index.get(r.source)!,
        b: index.get(r.target)!,
        type: r.type,
      }));

    let raf = 0;
    let running = true;
    const mouse = { x: 0, y: 0 };
    let hover: Node | undefined;
    let drag: Node | undefined;

    const fit = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 800;
      const h = Math.max(420, Math.min(640, Math.floor(w * 0.62)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };
    let { w, h } = fit();

    const onResize = () => {
      ({ w, h } = fit());
    };
    window.addEventListener("resize", onResize);

    const toLocal = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left - w / 2, y: ev.clientY - rect.top - h / 2 };
    };

    const hit = (x: number, y: number) =>
      nodes.find((n) => (n.x - x) ** 2 + (n.y - y) ** 2 <= (n.r + 6) ** 2);

    const onMove = (ev: PointerEvent) => {
      const p = toLocal(ev);
      mouse.x = p.x;
      mouse.y = p.y;
      hover = hit(p.x, p.y);
      canvas.style.cursor = hover || drag ? "pointer" : "default";
      if (drag) {
        drag.x = p.x;
        drag.y = p.y;
        drag.vx = 0;
        drag.vy = 0;
      }
    };
    const onDown = (ev: PointerEvent) => {
      const p = toLocal(ev);
      drag = hit(p.x, p.y);
    };
    const onUp = () => {
      if (drag) select(drag.id);
      drag = undefined;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);

    const tick = () => {
      if (!running) return;
      const n = nodes.length;
      for (let i = 0; i < n; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const min = 28;
          if (dist < min) {
            const f = ((min - dist) /
... 