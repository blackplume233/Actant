import type { Router } from "../router";
import { json, error } from "../router";

export function registerCanvasRoutes(router: Router): void {
  // GET /v1/canvas — List all canvas entries
  router.get("/v1/canvas", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("canvas.list");
    json(res, result);
  });

  // GET /v1/canvas/:agentName — Get canvas for a specific agent
  router.get("/v1/canvas/:agentName", async (ctx, _req, res) => {
    try {
      const result = await ctx.bridge.call("canvas.get", { agentName: ctx.params.agentName });
      json(res, result);
    } catch {
      error(res, `No canvas for agent "${ctx.params.agentName}"`, 404);
    }
  });

  // POST /v1/canvas/:agentName — Update canvas (used by MCP tools)
  router.post("/v1/canvas/:agentName", async (ctx, _req, res) => {
    const { html, title } = ctx.body;
    if (!html) {
      return error(res, "html is required", 400);
    }
    const result = await ctx.bridge.call("canvas.update", {
      agentName: ctx.params.agentName,
      html,
      ...(title ? { title } : {}),
    });
    json(res, result);
  });

  // DELETE /v1/canvas/:agentName — Clear canvas
  router.delete("/v1/canvas/:agentName", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("canvas.clear", { agentName: ctx.params.agentName });
    json(res, result);
  });
}
