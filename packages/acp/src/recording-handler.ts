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
import type { ActivityRecorder } from "@actant/core";
import type { ClientCallbackHandler } from "./connection";

const logger = createLogger("recording-handler");

/**
 * Decorator that intercepts all ACP Client callbacks and records them
 * as ActivityRecords before delegating to the inner handler.
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
  /** Mutable activity session ID. See class doc for lifecycle details. */
  private currentSession: string | null = null;

  constructor(
    private readonly inner: ClientCallbackHandler,
    private readonly recorder: ActivityRecorder,
    private readonly agentName: string,
  ) {}

  /** Set the activity session ID for all subsequent recordings. */
  setCurrentSession(id: string | null): void {
    this.currentSession = id;
  }

  private activityId(acpSessionId: string): string {
    return this.currentSession ?? acpSessionId;
  }

  // ---- session/update (primary data stream) ----

  async sessionUpdate(params: SessionNotification): Promise<void> {
    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "session_update",
      data: params.update,
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record session_update"));

    return this.inner.sessionUpdate(params);
  }

  // ---- fs/write_text_file ----

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    const packed = await this.recorder.packContent(this.agentName, params.content);
    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "file_write",
      data: { path: params.path, ...packed },
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record file_write"));

    return this.inner.writeTextFile(params);
  }

  // ---- fs/read_text_file ----

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "file_read",
      data: { path: params.path },
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record file_read"));

    return this.inner.readTextFile(params);
  }

  // ---- session/request_permission ----

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const result = await this.inner.requestPermission(params);

    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "permission_request",
      data: {
        toolCall: params.toolCall
          ? { toolCallId: params.toolCall.toolCallId, title: params.toolCall.title, kind: params.toolCall.kind }
          : undefined,
        options: params.options.map((o) => ({ optionId: o.optionId, kind: o.kind, name: o.name })),
        outcome: result.outcome,
      },
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record permission_request"));

    return result;
  }

  // ---- terminal/create ----

  async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    if (!this.inner.createTerminal) throw new Error("Terminal not supported");
    const result = await this.inner.createTerminal(params);

    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "terminal_create",
      data: {
        terminalId: result.terminalId,
        command: params.command,
        args: params.args,
        cwd: params.cwd,
      },
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record terminal_create"));

    return result;
  }

  // ---- terminal/output ----

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    if (!this.inner.terminalOutput) throw new Error("Terminal not supported");
    const result = await this.inner.terminalOutput(params);

    const packed = await this.recorder.packContent(this.agentName, result.output);
    const data = "content" in packed
      ? { terminalId: params.terminalId, output: packed.content, truncated: result.truncated }
      : { terminalId: params.terminalId, outputRef: packed.contentRef, truncated: result.truncated };

    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "terminal_output",
      data,
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record terminal_output"));

    return result;
  }

  // ---- terminal/wait_for_exit ----

  async waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    if (!this.inner.waitForTerminalExit) throw new Error("Terminal not supported");
    const result = await this.inner.waitForTerminalExit(params);

    this.recorder.record(this.agentName, this.activityId(params.sessionId), {
      type: "terminal_exit",
      data: {
        terminalId: params.terminalId,
        exitCode: result.exitCode,
        signal: result.signal,
      },
    }).catch((e: unknown) => logger.warn({ err: e }, "Failed to record terminal_exit"));

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
