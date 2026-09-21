import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Workbench } from "@/components/views";
import { useCasefile } from "@/store/casefile";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const boot = () => {
      const s = useCasefile.getState();
      if (!s.cf.archives.length) s.loadDemo();
      else s.refreshDetect();
      setReady(true);
    };
    if (useCasefile.persist.hasHydrated()) boot();
    const unsub = useCasefile.persist.onFinishHydration(boot);
    const t = window.setTimeout(boot, 400);
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);

  if (!ready) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-muted">Opening casefile…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Workbench />
    </AppShell>
  );
}
