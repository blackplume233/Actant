import { createServer, type Server } from "node:net";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unlink } from "node:fs/promises";
import type { GatewayLeaseParams, GatewayLeaseResult } from "@actant/shared";
import { createLogger, ipcRequiresFileCleanup, isWindows } from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

const logger = createLogger("gateway-handlers");

interface LeaseEntry {
  server: Server;
  socketPath: string;
  agentName: string;
}

const activeLeases = new Map<string, LeaseEntry>();

export function registerGatewayHandlers(registry: HandlerRegistry): void {
  registry.register("gateway.lease", handleGatewayLease);
}

/**
 * Create a per-agent named pipe / unix socket that the IDE can connect to.
 * When the IDE connects, the socket is handed to `AcpGateway.acceptSocket()`
 * which bridges ACP traffic between the IDE and the downstream Agent.
 */
async function handleGatewayLease(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<GatewayLeaseResult> {
  const { agentName } = params as unknown as GatewayLeaseParams;

  const meta = ctx.agentManager.getAgent(agentName);
  if (!meta) {
    throw new Error(`Agent "${agentName}" not found`);
  }
  if (meta.status !== "running") {
    throw new Error(
      `Agent "${agentName}" is not running (status: ${meta.status}). ` +
      `Session Lease requires a running agent.`,
    );
  }

  if (!ctx.acpConnectionManager.has(agentName)) {
    throw new Error(
      `Agent "${agentName}" has no ACP connection. ` +
      `Session Lease requires an ACP-capable backend.`,
    );
  }

  const gateway = ctx.acpConnectionManager.getGateway(agentName);
  if (!gateway) {
    throw new Error(
      `No ACP Gateway found for agent "${agentName}". ` +
      `This is unexpected — the gateway should be pre-created when the agent connects.`,
    );
  }

  // Reuse existing lease if the gateway doesn't have an active upstream
  const existing = activeLeases.get(agentName);
  if (existing && !gateway.isUpstreamConnected) {
    logger.debug({ agentName }, "Reusing existing gateway lease socket");
    return { socketPath: existing.socketPath };
  }

  // If there's an active upstream, disconnect it first (single IDE at a time)
  if (existing && gateway.isUpstreamConnected) {
    gateway.disconnectUpstream();
  }

  // Clean up old lease server if any
  if (existing) {
    existing.server.close();
    if (ipcRequiresFileCleanup()) {
      await unlink(existing.socketPath).catch(() => {});
    }
    activeLeases.delete(agentName);
  }

  const socketPath = generateLeaseSocketPath(agentName);
  const server = await createLeaseServer(socketPath, agentName, ctx);

  activeLeases.set(agentName, { server, socketPath, agentName });

  logger.info({ agentName, socketPath }, "Gateway lease created");
  return { socketPath };
}

function generateLeaseSocketPath(agentName: string): string {
  const id = randomUUID().slice(0, 8);
  if (isWindows()) {
    const safeName = agentName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `\\\\.\\pipe\\actant-gw-${safeName}-${id}`;
  }
  return join(tmpdir(), `actant-gw-${agentName}-${id}.sock`);
}

async function createLeaseServer(
  socketPath: string,
  agentName: string,
  ctx: AppContext,
): Promise<Server> {
  if (ipcRequiresFileCleanup()) {
    await unlink(socketPath).catch(() => {});
  }

  return new Promise<Server>((resolve, reject) => {
    const server = createServer((socket) => {
      logger.info({ agentName }, "IDE connected to gateway lease socket");
      try {
        ctx.acpConnectionManager.acceptLeaseSocket(agentName, socket);
      } catch (err) {
        logger.error({ agentName, error: err }, "Failed to accept lease socket");
        socket.destroy();
      }
    });

    server.on("error", (err) => {
      logger.error({ agentName, socketPath, error: err }, "Gateway lease server error");
    });

    server.on("close", () => {
      activeLeases.delete(agentName);
      if (ipcRequiresFileCleanup()) {
        unlink(socketPath).catch(() => {});
      }
    });

    server.listen(socketPath, () => {
      logger.debug({ agentName, socketPath }, "Gateway lease server listening");
      resolve(server);
    });

    server.on("error", reject);
  });
}

/**
 * Clean up all active lease servers. Called during daemon shutdown.
 */
export async function disposeAllLeases(): Promise<void> {
  const entries = Array.from(activeLeases.values());
  activeLeases.clear();
  for (const entry of entries) {
    entry.server.close();
    if (ipcRequiresFileCleanup()) {
      await unlink(entry.socketPath).catch(() => {});
    }
  }
  if (entries.length > 0) {
    logger.info({ count: entries.length }, "All gateway leases disposed");
  }
}
