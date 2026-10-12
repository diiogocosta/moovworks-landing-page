import type { APIRoute } from "astro";
import { absolute } from "../lib/site";

/**
 * Generated rather than dropped in `public/` so the sitemap URL is derived from
 * the configured origin and cannot go stale if the domain ever changes.
 */
export const GET: APIRoute = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${absolute("/sitemap.xml")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
