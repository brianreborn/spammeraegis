import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Run TanStack Start server fns in the browser; Grok host is not in this SPA. */
function tanstackStartStub(): Plugin {
  const resolvedId = "\0virtual:@tanstack/react-start";
  return {
    name: "tanstack-start-stub",
    resolveId(id) {
      if (id === "@tanstack/react-start") return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      return `
export function createServerFn(_opts) {
  const state = {
    validate: (d) => d,
    handle: async () => undefined,
  };
  const api = {
    validator(fn) {
      state.validate = fn;
      return api;
    },
    handler(fn) {
      state.handle = fn;
      return async (opts = {}) => {
        const data = await state.validate(opts.data);
        return state.handle({ data, method: _opts?.method ?? "GET" });
      };
    },
  };
  return api;
}
`;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tanstackStartStub()],
  resolve: {
    alias: { "@": path.resolve(rootDir, "src") },
  },
  server: { port: 8080, host: "127.0.0.1" },
});
