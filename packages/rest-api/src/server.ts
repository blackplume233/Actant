import type { IncomingMessage, ServerResponse, RequestListener } from "node:http";
import { Router, readBody, json, error } from "./router";
import type { RpcBridge } from "./rpc-bridge";
import { applyCors, handlePreflight, checkAuth } from "./middleware";
import { registerAllRoutes } from "./routes/index";
import { handleSSE } from "./routes/sse";
import { getRestApiPackageVersion } from "./package-version";

export interface ServerConfig {
  bridge: RpcBridge;
  apiKey?: string;
}

export function createApiHandler(config: ServerConfig): RequestListener {
  const { bridge, apiKey } = config;
  const router = new Router();
  const packageVersion = getRestApiPackageVersion();
  registerAllRoutes(router);

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const method = req.method ?? "GET";
    const pathname = url.pathname;

    applyCors(res);

    if (handlePreflight(req, res)) return;

    // Auth check (SSE supports query token for EventSource clients)
    if (pathname === "/v1/sse" || pathname === "/sse") {
      if (apiKey) {
        const sseToken = url.searchParams.get("api_key") ?? url.searchParams.get("token");
        if (sseToken !== apiKey) {
          return error(res, "Unauthorized SSE request. Provide ?api_key=<key>.", 401);
        }
      }
    } else {
      const auth = checkAuth(req, apiKey);
      if (!auth.ok) {
        return error(res, auth.message ?? "Unauthorized", 401);
      }
    }

    try {
      // SSE endpoint
      if (pathname === "/v1/sse" || pathname === "/sse") {
        return handleSSE(bridge, res);
      }

      // Discovery endpoint
      if (pathname === "/" || pathname === "/v1") {
        return json(res, {
          name: "Actant REST API",
          version: "v1",
          docs: "/v1/openapi",
          endpoints: {
            status: "/v1/status",
            agents: "/v1/agents",
            templates: "/v1/templates",
            events: "/v1/events",
            canvas: "/v1/canvas",
            skills: "/v1/skills",
            prompts: "/v1/prompts",
            mcpServers: "/v1/mcp-servers",
            workflows: "/v1/workflows",
            plugins: "/v1/plugins",
            sources: "/v1/sources",
            presets: "/v1/presets",
            sessions: "/v1/sessions",
            webhooks: "/v1/webhooks/message",
            sse: "/v1/sse",
          },
        });
      }

      // OpenAPI spec (minimal self-describing)
      if (pathname === "/v1/openapi") {
        return json(res, generateOpenApiSummary(packageVersion));
      }

      // Route matching
      const body = method === "GET" || method === "HEAD" ? {} : await readBody(req);
      const match = router.match(method, pathname);

      if (!match) {
        return error(res, `${method} ${pathname} not found`, 404);
      }

      await match.handler(
        { bridge, params: match.params, query: url.searchParams, body },
        req,
        res,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: number }).code;

      // Map RPC error codes to HTTP status
      let httpStatus = 500;
      if (code) {
        if (code === -32001 || code === -32003) httpStatus = 404;
        else if (code === -32002 || code === -32602) httpStatus = 400;
        else if (code === -32004 || code === -32009) httpStatus = 409;
        else if (code === -32601) httpStatus = 404;
      }

      // Fallback: infer HTTP status from error message patterns when no RPC code
      if (httpStatus === 500) {
        const lower = message.toLowerCase();
        if (/not found|does not exist|no such/.test(lower)) httpStatus = 404;
        else if (/required|missing|invalid|must be|cannot be empty/.test(lower)) httpStatus = 400;
        else if (/not running|no .* connection|already exists|no attached|has no/.test(lower)) httpStatus = 409;
        else if (/not support|not implemented/.test(lower)) httpStatus = 501;
      }

      error(res, message, httpStatus);
    }
  };
}

function generateOpenApiSummary(version: string): object {
  return {
    openapi: "3.0.3",
    info: {
      title: "Actant REST API",
      version,
      description: "RESTful API for the Actant AI agent platform. Serves dashboard, n8n, and IM integrations.",
    },
    servers: [{ url: "/v1", description: "API v1" }],
    paths: {
      "/status": { get: { summary: "Daemon status", tags: ["System"] } },
      "/shutdown": { post: { summary: "Shutdown daemon", tags: ["System"] } },
      "/agents": {
        get: { summary: "List all agents", tags: ["Agents"] },
        post: { summary: "Create agent", tags: ["Agents"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "template"], properties: { name: { type: "string" }, template: { type: "string" }, overrides: { type: "object" } } } } } } },
      },
      "/agents/{name}": {
        get: { summary: "Agent status", tags: ["Agents"] },
        delete: { summary: "Destroy agent", tags: ["Agents"] },
      },
      "/agents/{name}/start": { post: { summary: "Start agent", tags: ["Agents"] } },
      "/agents/{name}/stop": { post: { summary: "Stop agent", tags: ["Agents"] } },
      "/agents/{name}/prompt": { post: { summary: "Send prompt", tags: ["Agents"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string" }, sessionId: { type: "string" } } } } } } } },
      "/agents/{name}/run": { post: { summary: "One-shot run", tags: ["Agents"] } },
      "/agents/{name}/sessions": { get: { summary: "List conversation sessions", tags: ["Activity"] } },
      "/agents/{name}/sessions/{sessionId}": { get: { summary: "Get conversation", tags: ["Activity"] } },
      "/agents/{name}/logs": { get: { summary: "Process logs", tags: ["Activity"] } },
      "/agents/{name}/tasks": { get: { summary: "Agent tasks", tags: ["Schedule"] } },
      "/agents/{name}/schedule": { get: { summary: "Agent schedule", tags: ["Schedule"] } },
      "/agents/{name}/permissions": { put: { summary: "Update permissions", tags: ["Agents"] } },
      "/agents/{name}/dispatch": { post: { summary: "Dispatch task", tags: ["Schedule"] } },
      "/agents/{name}/attach": { post: { summary: "Attach process", tags: ["Agents"] } },
      "/agents/{name}/detach": { post: { summary: "Detach process", tags: ["Agents"] } },
      "/templates": {
        get: { summary: "List templates", tags: ["Templates"] },
        post: { summary: "Create template", tags: ["Templates"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "version", "backend"], description: "AgentTemplate JSON object" } } } } },
      },
      "/templates/{name}": { get: { summary: "Get template", tags: ["Templates"] } },
      "/templates/{name}/load": { post: { summary: "Load template", tags: ["Templates"] } },
      "/templates/{name}/unload": { post: { summary: "Unload template", tags: ["Templates"] } },
      "/templates/{name}/validate": { post: { summary: "Validate template", tags: ["Templates"] } },
      "/events": { get: { summary: "Recent events", tags: ["Events"] } },
      "/canvas": { get: { summary: "List canvas", tags: ["Canvas"] } },
      "/canvas/{agentName}": {
        get: { summary: "Get canvas", tags: ["Canvas"] },
        post: { summary: "Update canvas", tags: ["Canvas"] },
        delete: { summary: "Clear canvas", tags: ["Canvas"] },
      },
      "/skills": { get: { summary: "List skills", tags: ["Domain"] } },
      "/skills/{name}": { get: { summary: "Get skill", tags: ["Domain"] } },
      "/prompts": { get: { summary: "List prompts", tags: ["Domain"] } },
      "/prompts/{name}": { get: { summary: "Get prompt", tags: ["Domain"] } },
      "/mcp-servers": { get: { summary: "List MCP servers", tags: ["Domain"] } },
      "/mcp-servers/{name}": { get: { summary: "Get MCP server", tags: ["Domain"] } },
      "/workflows": { get: { summary: "List workflows", tags: ["Domain"] } },
      "/workflows/{name}": { get: { summary: "Get workflow", tags: ["Domain"] } },
      "/plugins": { get: { summary: "List plugins", tags: ["Domain"] } },
      "/plugins/{name}": { get: { summary: "Get plugin", tags: ["Domain"] } },
      "/sources": {
        get: { summary: "List sources", tags: ["Sources"] },
        post: { summary: "Add source", tags: ["Sources"] },
      },
      "/sources/{name}": { delete: { summary: "Remove source", tags: ["Sources"] } },
      "/sources/{name}/sync": { post: { summary: "Sync source", tags: ["Sources"] } },
      "/sources/{name}/validate": { post: { summary: "Validate source", tags: ["Sources"] } },
      "/presets": { get: { summary: "List presets", tags: ["Sources"] } },
      "/presets/{name}": { get: { summary: "Show preset", tags: ["Sources"] } },
      "/presets/{name}/apply": { post: { summary: "Apply preset", tags: ["Sources"] } },
      "/sessions": {
        get: { summary: "List sessions", tags: ["Sessions"] },
        post: { summary: "Create session", tags: ["Sessions"] },
      },
      "/sessions/{id}/prompt": { post: { summary: "Prompt session", tags: ["Sessions"] } },
      "/sessions/{id}/cancel": { post: { summary: "Cancel session", tags: ["Sessions"] } },
      "/sessions/{id}": { delete: { summary: "Close session", tags: ["Sessions"] } },
      "/webhooks/message": { post: { summary: "Universal message webhook", tags: ["Webhooks"] } },
      "/webhooks/run": { post: { summary: "One-shot run webhook", tags: ["Webhooks"] } },
      "/webhooks/event": { post: { summary: "External event webhook", tags: ["Webhooks"] } },
      "/sse": { get: { summary: "SSE real-time stream", tags: ["System"] } },
    },
  };
}
