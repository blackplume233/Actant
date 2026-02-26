import type {
  ActivitySessionsParams,
  ActivitySessionsResult,
  ActivityStreamParams,
  ActivityStreamResult,
  ActivityConversationParams,
  ActivityConversationResult,
  ActivityBlobParams,
  ActivityBlobResult,
  ConversationTurn,
  ConversationToolCall,
  ConversationFileOp,
} from "@actant/shared";
import type { AppContext } from "../services/app-context";
import type { HandlerRegistry } from "./handler-registry";

export function registerActivityHandlers(registry: HandlerRegistry): void {
  registry.register("activity.sessions", handleActivitySessions);
  registry.register("activity.stream", handleActivityStream);
  registry.register("activity.conversation", handleActivityConversation);
  registry.register("activity.blob", handleActivityBlob);
}

async function handleActivitySessions(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ActivitySessionsResult> {
  const { agentName } = params as unknown as ActivitySessionsParams;
  if (!ctx.activityRecorder) return [];
  return ctx.activityRecorder.getSessions(agentName);
}

async function handleActivityStream(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ActivityStreamResult> {
  const { agentName, sessionId, types, offset, limit } = params as unknown as ActivityStreamParams;
  if (!ctx.activityRecorder) return { records: [], total: 0 };
  return ctx.activityRecorder.readStream(agentName, sessionId, { types, offset, limit });
}

async function handleActivityConversation(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ActivityConversationResult> {
  const { agentName, sessionId } = params as unknown as ActivityConversationParams;
  if (!ctx.activityRecorder) return [];
  const { records } = await ctx.activityRecorder.readStream(agentName, sessionId);
  return assembleConversation(records);
}

async function handleActivityBlob(
  params: Record<string, unknown>,
  ctx: AppContext,
): Promise<ActivityBlobResult> {
  const { agentName, hash } = params as unknown as ActivityBlobParams;
  if (!ctx.activityRecorder) throw new Error("Activity recording not enabled");
  const content = await ctx.activityRecorder.readBlob(agentName, hash);
  return { content };
}

// ---------------------------------------------------------------------------
// Conversation assembly — group session_update records into turns
// ---------------------------------------------------------------------------

interface ActivityRecordLike {
  ts: number;
  type: string;
  data: unknown;
}

function assembleConversation(records: ActivityRecordLike[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let currentTurn: ConversationTurn | null = null;

  for (const r of records) {
    if (r.type === "prompt_sent") {
      const data = r.data as Record<string, unknown>;
      const content =
        typeof data.content === "string"
          ? data.content
          : (data.contentRef as Record<string, unknown> | undefined)?.preview as string ?? "";
      currentTurn = { role: "user", content, ts: r.ts, toolCalls: [], fileOps: [] };
      turns.push(currentTurn);
    } else if (r.type === "prompt_complete") {
      currentTurn = null;
    } else if (r.type === "session_update") {
      const data = r.data as Record<string, unknown>;
      const updateType = data.sessionUpdate as string;

      if (updateType === "user_message_chunk") {
        if (currentTurn?.role !== "user") {
          currentTurn = { role: "user", content: "", ts: r.ts, toolCalls: [], fileOps: [] };
          turns.push(currentTurn);
        }
        const block = data.content as Record<string, unknown> | undefined;
        if (block?.type === "text") {
          currentTurn.content += block.text as string;
        }
      } else if (updateType === "agent_message_chunk") {
        if (currentTurn?.role !== "assistant") {
          currentTurn = { role: "assistant", content: "", ts: r.ts, toolCalls: [], fileOps: [] };
          turns.push(currentTurn);
        }
        const block = data.content as Record<string, unknown> | undefined;
        if (block?.type === "text") {
          currentTurn.content += block.text as string;
        }
      } else if (updateType === "tool_call" || updateType === "tool_call_update") {
        if (!currentTurn || currentTurn.role !== "assistant") {
          currentTurn = { role: "assistant", content: "", ts: r.ts, toolCalls: [], fileOps: [] };
          turns.push(currentTurn);
        }
        const tc: ConversationToolCall = {
          toolCallId: data.toolCallId as string,
          title: data.title as string | undefined,
          kind: data.kind as string | undefined,
          status: data.status as string | undefined,
          input: data.input as string | undefined,
          output: data.output as string | undefined,
        };
        const existing = currentTurn.toolCalls.find((t) => t.toolCallId === tc.toolCallId);
        if (existing) {
          Object.assign(existing, tc);
        } else {
          currentTurn.toolCalls.push(tc);
        }
      }
    } else if (r.type === "file_write") {
      if (currentTurn) {
        const data = r.data as Record<string, unknown>;
        const op: ConversationFileOp = {
          type: "write",
          path: data.path as string,
          size: (data.contentRef as Record<string, unknown> | undefined)?.size as number | undefined,
          blobHash: (data.contentRef as Record<string, unknown> | undefined)?.hash as string | undefined,
        };
        currentTurn.fileOps.push(op);
      }
    } else if (r.type === "file_read") {
      if (currentTurn) {
        const data = r.data as Record<string, unknown>;
        currentTurn.fileOps.push({ type: "read", path: data.path as string });
      }
    }
  }

  return turns;
}
