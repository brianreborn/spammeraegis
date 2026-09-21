export function AppErrorComponent({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>SpammerAegis hit a snag</h1>
      <pre>{message}</pre>
    </main>
  );
}
