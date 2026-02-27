import type { Router } from "../router";
import { json, error } from "../router";

export function registerTemplateRoutes(router: Router): void {
  router.get("/v1/templates", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("template.list");
    json(res, result);
  });

  router.post("/v1/templates", async (ctx, _req, res) => {
    if (!ctx.body || typeof ctx.body !== "object" || !("name" in ctx.body) || !ctx.body.name) {
      return error(res, "request body must be a valid template object with a name field", 400);
    }
    const overwrite = ctx.query.get("overwrite") === "true";
    const result = await ctx.bridge.call("template.create", {
      template: ctx.body,
      overwrite,
    });
    json(res, result, 201);
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
