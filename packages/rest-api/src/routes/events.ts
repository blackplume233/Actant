import type { Router } from "../router";
import { json } from "../router";

export function registerEventRoutes(router: Router): void {
  router.get("/v1/events", async (ctx, _req, res) => {
    const limit = parseInt(ctx.query.get("limit") ?? "50", 10);
    try {
      const result = await ctx.bridge.call("events.recent", { limit });
      json(res, result);
    } catch {
      json(res, { events: [] });
    }
  });
}
