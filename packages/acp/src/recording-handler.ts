import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
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
} from "@agentclientprotocol/sdk";
import { createLogger } from "@actant/shared";
import type { RecordSystem } from "@actant/agent-runtime";
import type { ClientCallbackHandler } from "./connection";

const logger = createLogger("recording-handler");

/**
 * Decorator that intercepts all ACP Client callbacks and records them
 * via the unified RecordSystem (preferred) or legacy ActivityRecorder.
 *
 * Placement in the callback chain:
 *   AcpConnection → RecordingCallbackHandler → ClientCallbackRouter → Local/IDE
 *
 * Only injected for `processOwnership: "managed"` agents.
 *
 * ## Activity session routing
 *
 * The `currentSession` field determines which activity session all callbacks
 * are recorded under. Callers update it via `setCurrentSession()`:
 *
 * - **Employee agents**: set once after connecting (stable, persists across
 *   ACP restarts). Never cleared. All activity accumulates in one session.
 * - **Service agents**: set to the chat lease ID before each prompt, then
 *   cleared after. Each client lease maps to one conversation record.
 *
 * When `currentSession` is null (not yet set), callbacks fall back to the
 * ACP session UUID from the callback parameters.
 */
export class RecordingCallbackHandler implements ClientCallbackHandler {
  private currentSession: string | null = null;

  constructor(
    private readonly inner: ClientCallbackHandler,
    private readonly recordSystem: RecordSystem,
    private readonly agentName: string,
  ) {}

  /** Set the activity session ID for all subsequent recordings. */
  setCurrentSession(id: string | null): void {
    this.currentSession = id;
  }

  private activityId(acpSessionId: string): string {
    return this.currentSession ?? acpSessionId;
  }

  private recordSafe(
    sessionId: string,
    category: string,
    type: string,
    data: unknown,
  ): void {
    const sid = this.activityId(sessionId);
    this.recordSystem.record({
      category: category as import("@actant/shared").RecordCategory,
      type,
      agentName: this.agentName,
      sessionId: sid,
      data,
    }).catch((e: unknown) => logger.warn({ err: e, type }, "Failed to record"));
  }

  private async packSafe(content: string) {
    return this.recordSystem.packContent(this.agentName, content);
  }

  // ---- session/update (primary data stream) ----

  async sessionUpdate(params: SessionNotification): Promise<void> {
    this.recordSafe(params.sessionId, "communication", "session_update", params.update);
    return this.inner.sessionUpdate(params);
  }

  // ---- fs/write_text_file ----

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    const packed = await this.packSafe(params.content);
    this.recordSafe(params.sessionId, "file", "file_write", { path: params.path, ...packed });
    return this.inner.writeTextFile(params);
  }

  // ---- fs/read_text_file ----

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    this.recordSafe(params.sessionId, "file", "file_read", { path: params.path });
    return this.inner.readTextFile(params);
  }

  // ---- session/request_permission ----

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const result = await this.inner.requestPermission(params);
    this.recordSafe(params.sessionId, "permission", "permission_request", {
      toolCall: params.toolCall
        ? { toolCallId: params.toolCall.toolCallId, title: params.toolCall.title, kind: params.toolCall.kind }
        : undefined,
      options: params.options.map((o) => ({ optionId: o.optionId, kind: o.kind, name: o.name })),
      outcome: result.outcome,
    });
    return result;
  }

  // ---- terminal/create ----

  async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    if (!this.inner.createTerminal) throw new Error("Terminal not supported");
    const result = await this.inner.createTerminal(params);
    this.recordSafe(params.sessionId, "terminal", "terminal_create", {
      terminalId: result.terminalId,
      command: params.command,
      args: params.args,
      cwd: params.cwd,
    });
    return result;
  }

  // ---- terminal/output ----

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    if (!this.inner.terminalOutput) throw new Error("Terminal not supported");
    const result = await this.inner.terminalOutput(params);
    const packed = await this.packSafe(result.output);
    const data = "content" in packed
      ? { terminalId: params.terminalId, output: packed.content, truncated: result.truncated }
      : { terminalId: params.terminalId, outputRef: packed.contentRef, truncated: result.truncated };
    this.recordSafe(params.sessionId, "terminal", "terminal_output", data);
    return result;
  }

  // ---- terminal/wait_for_exit ----

  async waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    if (!this.inner.waitForTerminalExit) throw new Error("Terminal not supported");
    const result = await this.inner.waitForTerminalExit(params);
    this.recordSafe(params.sessionId, "terminal", "terminal_exit", {
      terminalId: params.terminalId,
      exitCode: result.exitCode,
      signal: result.signal,
    });
    return result;
  }

  // ---- terminal/kill (pass-through, low audit value) ----

  async killTerminal(params: KillTerminalCommandRequest): Promise<KillTerminalCommandResponse> {
    if (!this.inner.killTerminal) throw new Error("Terminal not supported");
    return this.inner.killTerminal(params);
  }

  // ---- terminal/release (pass-through, low audit value) ----

  async releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> {
    if (!this.inner.releaseTerminal) throw new Error("Terminal not supported");
    return this.inner.releaseTerminal(params);
  }
}
