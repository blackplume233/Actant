import type { Router } from "../router";
import { json } from "../router";

export function registerCatalogRoutes(router: Router): void {
  router.get("/v1/catalogs", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("catalog.list");
    json(res, result);
  });

  router.post("/v1/catalogs", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("catalog.add", ctx.body);
    json(res, result, 201);
  });

  router.delete("/v1/catalogs/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("catalog.remove", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/catalogs/:name/sync", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("catalog.sync", { name: ctx.params.name });
    json(res, result);
  });

  router.post("/v1/catalogs/:name/validate", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("catalog.validate", { name: ctx.params.name });
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
