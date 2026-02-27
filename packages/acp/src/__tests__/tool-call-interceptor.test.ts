import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolCallInterceptor } from "../tool-call-interceptor";
import type { SessionNotification } from "@agentclientprotocol/sdk";

function makeNotification(
  sessionUpdate: string,
  title?: string,
): SessionNotification {
  return {
    sessionId: "test-session",
    update: {
      sessionUpdate,
      title,
      toolCallId: "tc-1",
    },
  } as unknown as SessionNotification;
}

describe("ToolCallInterceptor", () => {
  let recorder: { record: ReturnType<typeof vi.fn> };
  let interceptor: ToolCallInterceptor;

  beforeEach(() => {
    recorder = { record: vi.fn().mockResolvedValue(undefined) };
    interceptor = new ToolCallInterceptor(
      ["actant_canvas_update", "actant_canvas_clear"],
      recorder as never,
      "test-agent",
    );
  });

  it("detects known internal tool by title", () => {
    expect(interceptor.isInternalTool("Bash(actant internal actant_canvas_update --token xxx --html ...)")).toBe(true);
    expect(interceptor.isInternalTool("actant_canvas_clear")).toBe(true);
    expect(interceptor.isInternalTool("Bash(actant internal canvas update --token xxx)")).toBe(true);
    expect(interceptor.isInternalTool("actant canvas clear")).toBe(true);
  });

  it("does not match unrelated tools", () => {
    expect(interceptor.isInternalTool("ReadFile(src/index.ts)")).toBe(false);
    expect(interceptor.isInternalTool("Bash(npm install)")).toBe(false);
  });

  it("records audit on matching tool_call", async () => {
    await interceptor.onToolCall(
      makeNotification("tool_call", "Bash(actant internal canvas update --token abc --html '<h1>hi</h1>')"),
    );
    expect(recorder.record).toHaveBeenCalledOnce();
    expect(recorder.record).toHaveBeenCalledWith(
      "test-agent",
      "test-session",
      expect.objectContaining({
        type: "internal_tool_call",
      }),
    );
  });

  it("ignores non-tool_call events", async () => {
    await interceptor.onToolCall(makeNotification("agent_message_chunk"));
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("ignores tool_call for unrelated tools", async () => {
    await interceptor.onToolCall(makeNotification("tool_call", "ReadFile(foo.ts)"));
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("works without recorder (no-op)", async () => {
    const bare = new ToolCallInterceptor(["actant_canvas_update"]);
    await bare.onToolCall(makeNotification("tool_call", "actant canvas update"));
    // Should not throw
  });

  it("handles empty title gracefully", async () => {
    await interceptor.onToolCall(makeNotification("tool_call", ""));
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("handles undefined title gracefully", async () => {
    await interceptor.onToolCall(makeNotification("tool_call"));
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("matches case-insensitively", () => {
    expect(interceptor.isInternalTool("ACTANT_CANVAS_UPDATE")).toBe(true);
    expect(interceptor.isInternalTool("Actant Canvas Clear")).toBe(true);
  });

  it("does not leak full token in recorded audit data", async () => {
    const fullToken = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
    await interceptor.onToolCall(
      makeNotification("tool_call", `Bash(actant internal canvas update --token ${fullToken} --html test)`),
    );
    expect(recorder.record).toHaveBeenCalledOnce();
    const callArg = recorder.record.mock.calls[0]![2] as { data: { tokenPrefix: string } };
    expect(callArg.data.tokenPrefix).toBe("");
  });
});
