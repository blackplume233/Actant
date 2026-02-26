import type { IncomingMessage, ServerResponse } from "node:http";
import type { RpcBridge } from "./rpc-bridge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteContext {
  bridge: RpcBridge;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
}

export type RouteHandler = (ctx: RouteContext, req: IncomingMessage, res: ServerResponse) => Promise<void>;

interface RouteEntry {
  method: string;
  pattern: string;
  segments: string[];
  handler: RouteHandler;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export class Router {
  private routes: RouteEntry[] = [];

  get(pattern: string, handler: RouteHandler): void {
    this.add("GET", pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): void {
    this.add("POST", pattern, handler);
  }

  put(pattern: string, handler: RouteHandler): void {
    this.add("PUT", pattern, handler);
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.add("DELETE", pattern, handler);
  }

  private add(method: string, pattern: string, handler: RouteHandler): void {
    this.routes.push({
      method,
      pattern,
      segments: pattern.split("/").filter(Boolean),
      handler,
    });
  }

  match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
    const parts = pathname.split("/").filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchSegments(route.segments, parts);
      if (params) return { handler: route.handler, params };
    }
    return null;
  }
}

function matchSegments(
  pattern: string[],
  actual: string[],
): Record<string, string> | null {
  if (pattern.length !== actual.length) return null;
  const params: Record<string, string> = {};

  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i];
    const val = actual[i];
    if (!seg || !val) return null;
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = decodeURIComponent(val);
    } else if (seg !== val) {
      return null;
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function error(res: ServerResponse, message: string, status = 500): void {
  json(res, { error: message, status }, status);
}

export function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}
