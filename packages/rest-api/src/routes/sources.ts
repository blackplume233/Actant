import type { Router } from "../router";
import { json } from "../router";

export function registerSourceRoutes(router: Router): void {
  router.get("/v1/sources", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("source.list");
    json(res, result);
  });

  router.post("/v1/sources", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("source.add", ctx.body);
    json(res, result, 201);
  });

  router.delete("/v1/sources/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("source.remove", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/sources/:name/sync", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("source.sync", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/sources/:name/validate", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("source.validate", { name: ctx.params.name });
    json(res, result);
  });

  router.get("/v1/presets", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("preset.list");
    json(res, result);
  });

  router.get("/v1/presets/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("preset.show", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/presets/:name/apply", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("preset.apply", { name: ctx.params.name, ...ctx.body });
    json(res, result);
  });
}
