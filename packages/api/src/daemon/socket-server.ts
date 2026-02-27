import { createServer, type Server, type Socket } from "node:net";
import {
  createLogger,
  ActantError,
  RPC_ERROR_CODES,
  type RpcRequest,
  type RpcResponse,
} from "@actant/shared";
import type { HandlerRegistry } from "../handlers/index";
import type { AppContext } from "../services/app-context";

const logger = createLogger("socket-server");

const ERROR_CODE_MAP: Record<string, number> = {
  TEMPLATE_NOT_FOUND: RPC_ERROR_CODES.TEMPLATE_NOT_FOUND,
  CONFIG_VALIDATION_ERROR: RPC_ERROR_CODES.CONFIG_VALIDATION,
  AGENT_NOT_FOUND: RPC_ERROR_CODES.AGENT_NOT_FOUND,
  AGENT_ALREADY_RUNNING: RPC_ERROR_CODES.AGENT_ALREADY_RUNNING,
  WORKSPACE_INIT_ERROR: RPC_ERROR_CODES.WORKSPACE_INIT,
  COMPONENT_REFERENCE_ERROR: RPC_ERROR_CODES.COMPONENT_REFERENCE,
  INSTANCE_CORRUPTED: RPC_ERROR_CODES.INSTANCE_CORRUPTED,
  AGENT_LAUNCH_ERROR: RPC_ERROR_CODES.AGENT_LAUNCH,
  AGENT_ALREADY_ATTACHED: RPC_ERROR_CODES.AGENT_ALREADY_ATTACHED,
  AGENT_NOT_ATTACHED: RPC_ERROR_CODES.AGENT_NOT_ATTACHED,
};

function mapErrorCode(err: ActantError): number {
  return ERROR_CODE_MAP[err.code] ?? RPC_ERROR_CODES.GENERIC_BUSINESS;
}

export class SocketServer {
  private server: Server | null = null;
  private connections = new Set<Socket>();

  constructor(
    private readonly handlers: HandlerRegistry,
    private readonly ctx: AppContext,
  ) {}

  listen(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket));

      this.server.on("error", (err) => {
        logger.error({ error: err }, "Socket server error");
        reject(err);
      });

      this.server.listen(socketPath, () => {
        logger.info({ socketPath }, "Socket server listening");
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    for (const conn of this.connections) {
      conn.destroy();
    }
    this.connections.clear();

    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        logger.info("Socket server closed");
        resolve();
      });
    });
  }

  private handleConnection(socket: Socket): void {
    this.connections.add(socket);
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.processMessage(trimmed, socket);
      }
    });

    socket.on("close", () => {
      this.connections.delete(socket);
    });

    socket.on("error", (err) => {
      logger.debug({ error: err.message }, "Client connection error");
      this.connections.delete(socket);
    });
  }

  private processMessage(raw: string, socket: Socket): void {
    let request: RpcRequest;

    try {
      request = JSON.parse(raw) as RpcRequest;
    } catch {
      this.sendResponse(socket, {
        jsonrpc: "2.0",
        id: 0,
        error: { code: RPC_ERROR_CODES.PARSE_ERROR, message: "Invalid JSON" },
      });
      return;
    }

    if (!request.jsonrpc || request.jsonrpc !== "2.0" || !request.method || request.id == null) {
      this.sendResponse(socket, {
        jsonrpc: "2.0",
        id: request.id ?? 0,
        error: { code: RPC_ERROR_CODES.INVALID_REQUEST, message: "Invalid JSON-RPC 2.0 request" },
      });
      return;
    }

    const handler = this.handlers.get(request.method);
    if (!handler) {
      this.sendResponse(socket, {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: RPC_ERROR_CODES.METHOD_NOT_FOUND, message: `Method not found: ${request.method}` },
      });
      return;
    }

    handler(request.params ?? {}, this.ctx)
      .then((result) => {
        this.sendResponse(socket, {
          jsonrpc: "2.0",
          id: request.id,
          result,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof ActantError) {
          this.sendResponse(socket, {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: mapErrorCode(err),
              message: err.message,
              data: { errorCode: err.code, context: err.context },
            },
          });
        } else {
          const errObj = err as Record<string, unknown>;
          const explicitCode = typeof errObj?.code === "number" ? errObj.code : undefined;
          const allCodes = new Set<number>(Object.values(RPC_ERROR_CODES));
          const rpcCode = explicitCode && allCodes.has(explicitCode) ? explicitCode : RPC_ERROR_CODES.INTERNAL_ERROR;
          if (rpcCode === RPC_ERROR_CODES.INTERNAL_ERROR) {
            logger.error({ error: err }, "Unhandled handler error");
          }
          this.sendResponse(socket, {
            jsonrpc: "2.0",
            id: request.id,
            error: { code: rpcCode, message: err instanceof Error ? err.message : "Internal error" },
          });
        }
      });
  }

  private sendResponse(socket: Socket, response: RpcResponse): void {
    if (!socket.destroyed) {
      socket.write(JSON.stringify(response) + "\n");
    }
  }
}
