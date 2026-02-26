import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  IncomingMessage,
  ServerResponse,
  RequestListener,
} from "node:http";
import { createApiHandler, RpcBridge } from "@actant/rest-api";

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

export function createRequestHandler(socketPath: string): RequestListener {
  const bridge = new RpcBridge(socketPath);
  const apiHandler = createApiHandler({ bridge });
  const clientDir = getClientDir();

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    // Delegate API and SSE requests to the rest-api handler
    if (
      pathname.startsWith("/v1/") ||
      pathname === "/v1" ||
      pathname === "/sse" ||
      pathname.startsWith("/api/")
    ) {
      // Rewrite legacy /api/* to /v1/* for backward compatibility
      if (pathname.startsWith("/api/")) {
        const rewritten = pathname.replace("/api/", "/v1/");
        const originalUrl = req.url;
        req.url = rewritten + url.search;
        await apiHandler(req, res);
        req.url = originalUrl;
        return;
      }

      // /sse → /v1/sse rewrite
      if (pathname === "/sse") {
        const originalUrl = req.url;
        req.url = "/v1/sse";
        await apiHandler(req, res);
        req.url = originalUrl;
        return;
      }

      return apiHandler(req, res);
    }

    // Static files for the SPA
    try {
      await serveStatic(clientDir, pathname, res);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  };
}

async function serveStatic(
  clientDir: string,
  pathname: string,
  res: ServerResponse,
): Promise<void> {
  const filePath = pathname === "/" ? "/index.html" : pathname;
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
