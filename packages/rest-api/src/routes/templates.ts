import type { Router } from "../router";
import { json } from "../router";

export function registerTemplateRoutes(router: Router): void {
  router.get("/v1/templates", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("template.list");
    json(res, result);
  });

  router.get("/v1/templates/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("template.get", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/templates/:name/load", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("template.load", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/templates/:name/unload", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("template.unload", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/templates/:name/validate", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("template.validate", { name: ctx.params.name });
    json(res, result);
  });
}
