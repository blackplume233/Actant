import type { Router } from "../router";
import { json } from "../router";

export function registerDomainRoutes(router: Router): void {
  // -----------------------------------------------------------------------
  // Skills
  // -----------------------------------------------------------------------
  router.get("/v1/skills", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("skill.list");
    json(res, result);
  });

  router.get("/v1/skills/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("skill.get", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // Prompts
  // -----------------------------------------------------------------------
  router.get("/v1/prompts", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("prompt.list");
    json(res, result);
  });

  router.get("/v1/prompts/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("prompt.get", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // MCP Servers
  // -----------------------------------------------------------------------
  router.get("/v1/mcp-servers", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("mcp.list");
    json(res, result);
  });

  router.get("/v1/mcp-servers/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("mcp.get", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // Workflows
  // -----------------------------------------------------------------------
  router.get("/v1/workflows", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("workflow.list");
    json(res, result);
  });

  router.get("/v1/workflows/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("workflow.get", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // Plugins
  // -----------------------------------------------------------------------
  router.get("/v1/plugins", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("plugin.list");
    json(res, result);
  });

  router.get("/v1/plugins/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("plugin.get", { name: ctx.params.name });
    json(res, result);
  });
}
