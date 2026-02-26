import type { Router } from "../router";
import { json } from "../router";

export function registerStatusRoutes(router: Router): void {
  // GET /v1/status — Daemon status (ping)
  router.get("/v1/status", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("daemon.ping");
    json(res, result);
  });

  // POST /v1/shutdown — Graceful daemon shutdown
  router.post("/v1/shutdown", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("daemon.shutdown");
    json(res, result);
  });
}
