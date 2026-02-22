import { spawn, type ChildProcess } from "node:child_process";
import { createLogger } from "@actant/shared";
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  KillTerminalCommandRequest,
  KillTerminalCommandResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  TerminalExitStatus,
} from "@agentclientprotocol/sdk";

const logger = createLogger("acp-terminal");

interface ManagedTerminal {
  id: string;
  process: ChildProcess;
  output: Buffer[];
  totalBytes: number;
  outputByteLimit: number;
  exitStatus: TerminalExitStatus | null;
  exitPromise: Promise<TerminalExitStatus>;
  disposed: boolean;
}

/**
 * Manages local terminal processes for ACP Client terminal/* callbacks.
 * Each terminal is a child process with captured stdout/stderr output.
 */
export class LocalTerminalManager {
  private terminals = new Map<string, ManagedTerminal>();
  private counter = 0;

  async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    const id = `term_${++this.counter}_${Date.now()}`;

    const envEntries: Record<string, string> = { ...process.env } as Record<string, string>;
    if (params.env) {
      for (const entry of params.env) {
        envEntries[entry.name] = entry.value;
      }
    }

    const proc = spawn(params.command, params.args ?? [], {
      cwd: params.cwd ?? undefined,
      env: envEntries,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    const limit = params.outputByteLimit ?? 1024 * 1024; // 1MB default
    const output: Buffer[] = [];
    let totalBytes = 0;

    const exitPromise = new Promise<TerminalExitStatus>((resolve) => {
      proc.on("exit", (code, signal) => {
        resolve({ exitCode: code ?? null, signal: signal ?? null });
      });
      proc.on("error", (err) => {
        logger.error({ terminalId: id, error: err }, "Terminal process error");
        resolve({ exitCode: 1, signal: null });
      });
    });

    const appendOutput = (chunk: Buffer) => {
      output.push(chunk);
      totalBytes += chunk.length;
      // Truncate from beginning if over limit
      while (totalBytes > limit && output.length > 1) {
        const removed = output.shift();
        if (removed) totalBytes -= removed.length;
      }
    };

    proc.stdout?.on("data", appendOutput);
    proc.stderr?.on("data", appendOutput);

    const terminal: ManagedTerminal = {
      id,
      process: proc,
      output,
      totalBytes,
      outputByteLimit: limit,
      exitStatus: null,
      exitPromise,
      disposed: false,
    };

    // Keep exitStatus updated via closure
    exitPromise.then((status) => { terminal.exitStatus = status; });

    this.terminals.set(id, terminal);
    logger.info({ terminalId: id, command: params.command, cwd: params.cwd }, "Terminal created");
    return { terminalId: id };
  }

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    const term = this.getTerminal(params.terminalId);
    const outputStr = Buffer.concat(term.output).toString("utf-8");
    const truncated = term.totalBytes > term.outputByteLimit;

    return {
      output: outputStr,
      truncated,
      ...(term.exitStatus != null ? { exitStatus: term.exitStatus } : {}),
    };
  }

  async waitForExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    const term = this.getTerminal(params.terminalId);
    const status = await term.exitPromise;
    return { exitCode: status.exitCode, signal: status.signal };
  }

  async killTerminal(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse> {
    const term = this.getTerminal(params.terminalId);
    if (!term.process.killed && term.exitStatus == null) {
      term.process.kill("SIGTERM");
      // Give it 3s to die gracefully, then SIGKILL
      setTimeout(() => {
        if (term.exitStatus == null && !term.process.killed) {
          term.process.kill("SIGKILL");
        }
      }, 3000);
    }
    return {};
  }

  async releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
    const term = this.terminals.get(params.terminalId);
    if (!term) return {};

    if (!term.process.killed && term.exitStatus == null) {
      term.process.kill("SIGKILL");
    }
    term.disposed = true;
    this.terminals.delete(params.terminalId);
    logger.debug({ terminalId: params.terminalId }, "Terminal released");
    return {};
  }

  disposeAll(): void {
    for (const [id, term] of this.terminals) {
      if (!term.process.killed && term.exitStatus == null) {
        term.process.kill("SIGKILL");
      }
      term.disposed = true;
      this.terminals.delete(id);
    }
  }

  private getTerminal(terminalId: string): ManagedTerminal {
    const term = this.terminals.get(terminalId);
    if (!term) {
      throw new Error(`Terminal "${terminalId}" not found or already released`);
    }
    return term;
  }
}
