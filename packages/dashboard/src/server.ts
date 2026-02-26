import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  IncomingMessage,
  ServerResponse,
  RequestListener,
} from "node:http";
import type { RpcBridge } from "./rpc-bridge";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function getClientDir(): string {
  const thisDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : join(fileURLToPath(import.meta.url), "..");
  return join(thisDir, "client");
}

export function createRequestHandler(bridge: RpcBridge): RequestListener {
  const clientDir = getClientDir();

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const pathname = url.pathname;

    // CORS for dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    try {
      if (pathname === "/sse") {
        return handleSSE(bridge, res);
      }

      if (pathname.startsWith("/api/")) {
        return await handleAPI(bridge, pathname, res);
      }

      // Static files
      return await serveStatic(clientDir, pathname, res);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  };
}

function handleSSE(bridge: RpcBridge, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const poll = async () => {
    const results = await Promise.allSettled([
      bridge.call("daemon.ping", {}),
      bridge.call("agent.list", {}),
      bridge.call("events.recent", { limit: 50 }),
    ]);

    if (results[0].status === "fulfilled") {
      send("status", results[0].value);
    } else {
      send("error", { message: "Daemon connection lost" });
      return;
    }

    if (results[1].status === "fulfilled") {
      send("agents", results[1].value);
    }

    if (results[2].status === "fulfilled") {
      send("events", results[2].value);
    } else {
      send("events", { events: [] });
    }
  };

  poll();
  const timer = setInterval(poll, 2000);

  res.on("close", () => {
    clearInterval(timer);
  });
}

async function handleAPI(
  bridge: RpcBridge,
  pathname: string,
  res: ServerResponse,
): Promise<void> {
  const parts = pathname.replace("/api/", "").split("/").filter(Boolean);
  // GET /api/status
  if (parts[0] === "status") {
    const result = await bridge.call("daemon.ping", {});
    return jsonResponse(res, result);
  }

  // GET /api/agent/:name/...
  if (parts[0] === "agent" && parts[1]) {
    const agentName = decodeURIComponent(parts[1]);
    const sub = parts[2];

    if (sub === "sessions") {
      const result = await bridge.call("activity.sessions", { agentName });
      return jsonResponse(res, result);
    }
    if (sub === "session" && parts[3]) {
      const sessionId = decodeURIComponent(parts[3]);
      if (parts[4] === "stream") {
        const result = await bridge.call("activity.stream", {
          agentName,
          sessionId,
        });
        return jsonResponse(res, result);
      }
      if (parts[4] === "conversation") {
        const result = await bridge.call("activity.conversation", {
          agentName,
          sessionId,
        });
        return jsonResponse(res, result);
      }
    }
    if (sub === "blob" && parts[3]) {
      const hash = decodeURIComponent(parts[3]);
      const result = await bridge.call("activity.blob", { agentName, hash });
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(result.content);
      return;
    }
    if (sub === "logs") {
      const result = await bridge.call("agent.logs", { name: agentName });
      return jsonResponse(res, result);
    }
    if (sub === "tasks") {
      const result = await bridge.call("agent.tasks", { name: agentName });
      return jsonResponse(res, result);
    }
    if (sub === "schedule") {
      const result = await bridge.call("schedule.list", { name: agentName });
      return jsonResponse(res, result);
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

async function serveStatic(
  clientDir: string,
  pathname: string,
  res: ServerResponse,
): Promise<void> {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = join(clientDir, filePath);

  try {
    const content = await readFile(fullPath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    // SPA fallback: serve index.html for any unmatched route
    try {
      const indexContent = await readFile(join(clientDir, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(indexContent);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(
        "Dashboard client not built. Run: pnpm --filter @actant/dashboard build:client",
      );
    }
  }
}

function jsonResponse(res: ServerResponse, data: unknown): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
