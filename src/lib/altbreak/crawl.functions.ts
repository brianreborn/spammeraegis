import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CrawlFetch } from "./crawl.server";

const Input = z.object({
  handles: z.array(z.string().min(1).max(24)).min(1).max(8),
  deep: z.boolean().optional(),
});

export const crawlProfiles = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<{ results: CrawlFetch[]; fetchedAt: string }> => {
    const { fetchPublicUsers } = await import("./crawl.server");
    const handles = data.handles.map((h) => h.trim()).filter(Boolean).slice(0, 8);
    const results = await fetchPublicUsers(handles, Boolean(data.deep));
    return { results, fetchedAt: new Date().toISOString() };
  });
