import type { Router } from "../router";
import { json, error } from "../router";

export function registerAgentRoutes(router: Router): void {
  // -----------------------------------------------------------------------
  // GET /v1/agents — List all agents
  // -----------------------------------------------------------------------
  router.get("/v1/agents", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("agent.list");
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents — Create a new agent
  // Body: { name, template, overrides? }
  // -----------------------------------------------------------------------
  router.post("/v1/agents", async (ctx, _req, res) => {
    const { name, template, overrides } = ctx.body;
    if (!name || !template) {
      return error(res, "name and template are required", 400);
    }
    const result = await ctx.bridge.call("agent.create", {
      name,
      template,
      ...(overrides ? { overrides } : {}),
    });
    json(res, result, 201);
  });

  // -----------------------------------------------------------------------
  // GET /v1/agents/:name — Agent status / details
  // -----------------------------------------------------------------------
  router.get("/v1/agents/:name", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("agent.status", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // DELETE /v1/agents/:name — Destroy an agent
  // Query: ?force=true
  // -----------------------------------------------------------------------
  router.delete("/v1/agents/:name", async (ctx, _req, res) => {
    const force = ctx.query.get("force") === "true";
    const result = await ctx.bridge.call("agent.destroy", { name: ctx.params.name, force });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/start — Start an agent
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/start", async (ctx, _req, res) => {
    const autoInstall = ctx.body.autoInstall as boolean | undefined;
    const result = await ctx.bridge.call("agent.start", {
      name: ctx.params.name,
      ...(autoInstall != null ? { autoInstall } : {}),
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/stop — Stop an agent
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/stop", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("agent.stop", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/prompt — Send a prompt to an agent
  // Body: { message, sessionId? }
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/prompt", async (ctx, _req, res) => {
    const { message, sessionId } = ctx.body;
    if (!message) {
      return error(res, "message is required", 400);
    }
    const result = await ctx.bridge.call("agent.prompt", {
      name: ctx.params.name,
      message,
      ...(sessionId ? { sessionId } : {}),
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/run — Run a one-shot prompt (fire-and-wait)
  // Body: { prompt, options? }
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/run", async (ctx, _req, res) => {
    const { prompt, options } = ctx.body;
    if (!prompt) {
      return error(res, "prompt is required", 400);
    }
    const result = await ctx.bridge.call("agent.run", {
      name: ctx.params.name,
      prompt,
      ...(options ? { options } : {}),
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/dispatch — Dispatch a scheduled task
  // Body: { prompt }
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/dispatch", async (ctx, _req, res) => {
    const { prompt } = ctx.body;
    if (!prompt) {
      return error(res, "prompt is required", 400);
    }
    const result = await ctx.bridge.call("agent.dispatch", {
      name: ctx.params.name,
      prompt,
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // PUT /v1/agents/:name/permissions — Update agent permissions
  // Body: { permissions }
  // -----------------------------------------------------------------------
  router.put("/v1/agents/:name/permissions", async (ctx, _req, res) => {
    const { permissions } = ctx.body;
    if (!permissions) {
      return error(res, "permissions object is required", 400);
    }
    const result = await ctx.bridge.call("agent.updatePermissions", {
      name: ctx.params.name,
      permissions,
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // GET /v1/agents/:name/sessions — List conversation sessions
  // -----------------------------------------------------------------------
  router.get("/v1/agents/:name/sessions", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("activity.sessions", { agentName: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // GET /v1/agents/:name/sessions/:sessionId — Get conversation turns
  // -----------------------------------------------------------------------
  router.get("/v1/agents/:name/sessions/:sessionId", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("activity.conversation", {
      agentName: ctx.params.name,
      sessionId: ctx.params.sessionId,
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // GET /v1/agents/:name/logs — Get process logs
  // Query: ?stream=stdout|stderr&lines=100
  // -----------------------------------------------------------------------
  router.get("/v1/agents/:name/logs", async (ctx, _req, res) => {
    const stream = ctx.query.get("stream") ?? "stdout";
    const lines = parseInt(ctx.query.get("lines") ?? "200", 10);
    try {
      const result = await ctx.bridge.call("agent.processLogs", {
        name: ctx.params.name,
        stream,
        lines,
      });
      json(res, result);
    } catch {
      json(res, { lines: [], stream, logDir: "" });
    }
  });

  // -----------------------------------------------------------------------
  // GET /v1/agents/:name/tasks — Get agent tasks (schedule)
  // -----------------------------------------------------------------------
  router.get("/v1/agents/:name/tasks", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("agent.tasks", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // GET /v1/agents/:name/schedule — Get agent schedule config
  // -----------------------------------------------------------------------
  router.get("/v1/agents/:name/schedule", async (ctx, _req, res) => {
    const result = await ctx.bridge.call("schedule.list", { name: ctx.params.name });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/attach — Attach a running process
  // Body: { pid, metadata? }
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/attach", async (ctx, _req, res) => {
    const { pid, metadata } = ctx.body;
    if (!pid) {
      return error(res, "pid is required", 400);
    }
    const result = await ctx.bridge.call("agent.attach", {
      name: ctx.params.name,
      pid,
      ...(metadata ? { metadata } : {}),
    });
    json(res, result);
  });

  // -----------------------------------------------------------------------
  // POST /v1/agents/:name/detach — Detach process
  // Body: { cleanup? }
  // -----------------------------------------------------------------------
  router.post("/v1/agents/:name/detach", async (ctx, _req, res) => {
    const { cleanup } = ctx.body;
    const result = await ctx.bridge.call("agent.detach", {
      name: ctx.params.name,
      ...(cleanup != null ? { cleanup } : {}),
    });
    json(res, result);
  });
}
