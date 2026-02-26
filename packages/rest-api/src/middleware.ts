import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function applyCors(res: ServerResponse, origin = "*"): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function handlePreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === "OPTIONS") {
    applyCors(res);
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// API Key Auth (optional — skipped when no key configured)
// ---------------------------------------------------------------------------

export function checkAuth(
  req: IncomingMessage,
  apiKey: string | undefined,
): { ok: boolean; message?: string } {
  if (!apiKey) return { ok: true };

  const header = req.headers["authorization"] ?? req.headers["x-api-key"];
  if (!header) {
    return { ok: false, message: "Missing API key. Set Authorization: Bearer <key> or X-API-Key header." };
  }

  const token = typeof header === "string"
    ? header.replace(/^Bearer\s+/i, "").trim()
    : "";

  if (token !== apiKey) {
    return { ok: false, message: "Invalid API key." };
  }

  return { ok: true };
}
