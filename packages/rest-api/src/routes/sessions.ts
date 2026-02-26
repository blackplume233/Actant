import type { Router } from "../router";
import { json, error } from "../router";
import { URL } from "node:url";

export function registerSessionRoutes(router: Router): void {
  router.get("/v1/sessions", async (ctx, req, res) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const agentName = url.searchParams.get("agentName") ?? undefined;
    const result = await ctx.bridge.call("session.list", { agentName });
    json(res, result);
  });

  router.post("/v1/sessions", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("session.create", ctx.body);
    json(res, result, 201);
  });

  router.post("/v1/sessions/:id/prompt", async (ctx, _req, res) => {
    const { message } = ctx.body;
    if (!message) {
      return error(res, "message is required", 400);
    }
    const result = await ctx.bridge.call("session.prompt", {
      sessionId: ctx.params.id,
      text: message,
    });
    json(res, result);
  });

  router.post("/v1/sessions/:id/cancel", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("session.cancel", { sessionId: ctx.params.id });
    json(res, result);
  });

  router.delete("/v1/sessions/:id", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("session.close", { sessionId: ctx.params.id });
    json(res, result);
  });
}
