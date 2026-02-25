import { exec } from "node:child_process";
import { createLogger } from "@actant/shared";
import type { HookAction, ShellAction, BuiltinAction, AgentAction } from "@actant/shared";
import type { HookEventPayload } from "./hook-event-bus";

const logger = createLogger("action-runner");

export interface ActionContext {
  /** CWD for shell actions. Falls back to process.cwd(). */
  cwd?: string;
  /** Substitution variables available in templates (e.g. `${agent.name}`). */
  vars?: Record<string, string>;
  /** Function to send a prompt to an agent (for type: "agent" actions). */
  promptAgent?: (agentName: string, prompt: string) => Promise<string>;
}

export interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Execute a list of hook actions sequentially.
 * If one action fails, subsequent actions still run (best-effort).
 */
export async function runActions(
  actions: HookAction[],
  payload: HookEventPayload,
  ctx: ActionContext,
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const action of actions) {
    const result = await runSingleAction(action, payload, ctx);
    results.push(result);
    if (!result.success) {
      logger.warn({ action: action.type, event: payload.event, error: result.error }, "Hook action failed, continuing");
    }
  }
  return results;
}

async function runSingleAction(
  action: HookAction,
  payload: HookEventPayload,
  ctx: ActionContext,
): Promise<ActionResult> {
  switch (action.type) {
    case "shell":
      return runShellAction(action, payload, ctx);
    case "builtin":
      return runBuiltinAction(action, payload, ctx);
    case "agent":
      return runAgentAction(action, payload, ctx);
    default: {
      const _exhaustive: never = action;
      return { success: false, error: `Unknown action type: ${(_exhaustive as HookAction).type}` };
    }
  }
}

function interpolate(template: string, payload: HookEventPayload, vars?: Record<string, string>): string {
  let result = template;
  if (payload.agentName) {
    result = result.replace(/\$\{agent\.name\}/g, payload.agentName);
  }
  result = result.replace(/\$\{event\}/g, payload.event);
  result = result.replace(/\$\{timestamp\}/g, payload.timestamp);
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
    }
  }
  return result;
}

function runShellAction(
  action: ShellAction,
  payload: HookEventPayload,
  ctx: ActionContext,
): Promise<ActionResult> {
  const command = action.run;
  if (!command) {
    return Promise.resolve({ success: false, error: "Shell action missing 'run' field" });
  }

  const interpolated = interpolate(command, payload, ctx.vars);
  logger.debug({ command: interpolated, event: payload.event }, "Executing shell action");

  return new Promise((resolve) => {
    exec(interpolated, { cwd: ctx.cwd, timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, output: stdout, error: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
}

async function runBuiltinAction(
  action: BuiltinAction,
  payload: HookEventPayload,
  _ctx: ActionContext,
): Promise<ActionResult> {
  const actionName = action.action;
  if (!actionName) {
    return { success: false, error: "Builtin action missing 'action' field" };
  }

  logger.debug({ action: actionName, event: payload.event }, "Executing builtin action");

  switch (actionName) {
    case "actant.log":
      logger.info({ event: payload.event, agentName: payload.agentName, params: action.params }, "Hook log action");
      return { success: true, output: `Logged event: ${payload.event}` };
    case "actant.healthcheck":
      return { success: true, output: "healthcheck: ok" };
    case "actant.notify":
      logger.info({ channel: action.params?.["channel"], message: action.params?.["message"] }, "Notification (stub)");
      return { success: true, output: `notification sent to ${action.params?.["channel"] ?? "default"}` };
    default:
      return { success: false, error: `Unknown builtin action: ${actionName}` };
  }
}

async function runAgentAction(
  action: AgentAction,
  payload: HookEventPayload,
  ctx: ActionContext,
): Promise<ActionResult> {
  const { target, prompt } = action;
  if (!target || !prompt) {
    return { success: false, error: "Agent action requires 'target' and 'prompt' fields" };
  }

  if (!ctx.promptAgent) {
    return { success: false, error: "No promptAgent function provided — cannot dispatch to agent" };
  }

  const interpolatedPrompt = interpolate(prompt, payload, ctx.vars);
  logger.debug({ target, event: payload.event }, "Executing agent action");

  try {
    const response = await ctx.promptAgent(target, interpolatedPrompt);
    return { success: true, output: response };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
