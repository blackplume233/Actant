import type { SessionNotification } from "@agentclientprotocol/sdk";
import type { ActivityRecorder } from "@actant/core";
import { createLogger } from "@actant/shared";

const logger = createLogger("tool-call-interceptor");

/**
 * Observes ACP sessionUpdate notifications for tool_call events
 * matching registered internal tools, and records audit entries.
 *
 * This interceptor does NOT execute tools — execution happens via
 * the `actant internal` CLI (Claude Code) or direct Pi tool injection.
 * Its role is observability and audit trail.
 */
export class ToolCallInterceptor {
  private knownToolPatterns: string[];

  constructor(
    knownToolNames: string[],
    private activityRecorder?: ActivityRecorder,
    private agentName?: string,
  ) {
    // Build multiple match patterns per tool:
    // "actant_canvas_update" → ["actant_canvas_update", "actant canvas update", "canvas update"]
    const patterns = new Set<string>();
    for (const n of knownToolNames) {
      patterns.add(n.toLowerCase());
      const spaced = n.replace(/_/g, " ").toLowerCase();
      patterns.add(spaced);
      // Strip leading "actant " prefix for partial matching
      const short = spaced.replace(/^actant\s+/, "");
      if (short !== spaced) patterns.add(short);
    }
    this.knownToolPatterns = Array.from(patterns);
  }

  /**
   * Check if a tool_call title matches a known internal tool.
   * Matches against patterns like "actant internal canvas update",
   * "actant_canvas_update", or "canvas update" anywhere in the title.
   */
  isInternalTool(title: string): boolean {
    const lower = title.toLowerCase();
    return this.knownToolPatterns.some((p) => lower.includes(p));
  }

  /**
   * Called on every sessionUpdate notification.
   * Records an audit entry when an internal tool call is observed.
   */
  async onToolCall(notification: SessionNotification): Promise<void> {
    const update = notification.update as Record<string, unknown>;
    if (update.sessionUpdate !== "tool_call") return;

    const title = (update.title as string) ?? "";
    if (!this.isInternalTool(title)) return;

    const safeTitle = title.replace(/--token[\s=]+(?:"[^"]*"|'[^']*'|\S+)/gi, "--token [REDACTED]");
    logger.debug(
      { agentName: this.agentName, title: safeTitle, sessionId: notification.sessionId },
      "Internal tool call observed",
    );

    if (this.activityRecorder && this.agentName) {
      this.activityRecorder.record(this.agentName, notification.sessionId, {
        type: "internal_tool_call",
        data: {
          tool: safeTitle,
          params: {},
          tokenPrefix: "",
          result: null,
          durationMs: 0,
          source: "observed",
        },
      }).catch((err) => {
        logger.warn({ err }, "Failed to record internal tool call observation");
      });
    }
  }
}
