import { Component, type ReactNode, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Workbench } from "@/components/views";
import { useCasefile } from "@/store/casefile";

class DeskErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-lg px-4 py-10 text-fg">
          <h1 className="text-xl font-semibold">SpammerAegis hit a snag</h1>
          <pre className="mt-4 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-danger">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="mt-4 h-11 rounded-md bg-primary px-4 text-sm text-primary-fg"
            onClick={() => {
              try {
                localStorage.removeItem("spammeraegis-casefile");
                localStorage.removeItem("altbreak-casefile");
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
          >
            Reset casefile and reload
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const boot = () => {
      try {
        const s = useCasefile.getState();
        if (!s.cf?.archives?.length) s.loadDemo();
        else s.refreshDetect();
      } catch (err) {
        console.error(err);
        useCasefile.getState().loadDemo();
      }
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

export function App() {
  return (
    <DeskErrorBoundary>
      <Home />
    </DeskErrorBoundary>
  );
}
