/**
 * Hook/Workflow system type definitions (Phase 4 #159, #135).
 *
 * Three event layers:
 *   Layer 1 — Actant system: actant:start/stop, agent:created/destroyed, source:updated, cron:*
 *   Layer 2 — Process lifecycle: process:start/stop/crash/restart
 *   Layer 3 — Instance runtime: session:start/end, prompt:before/after, error, idle, plugin:*
 */

export type HookEventName =
  | "actant:start"
  | "actant:stop"
  | "agent:created"
  | "agent:destroyed"
  | "agent:modified"
  | "source:updated"
  | "process:start"
  | "process:stop"
  | "process:crash"
  | "process:restart"
  | "session:start"
  | "session:end"
  | "prompt:before"
  | "prompt:after"
  | "error"
  | "idle"
  | `cron:${string}`
  | `plugin:${string}`;

export interface ShellAction {
  type: "shell";
  run: string;
}

export interface BuiltinAction {
  type: "builtin";
  action: string;
  params?: Record<string, unknown>;
}

export interface AgentAction {
  type: "agent";
  target: string;
  prompt: string;
}

export type HookAction = ShellAction | BuiltinAction | AgentAction;

export interface HookDeclaration {
  on: HookEventName;
  actions: HookAction[];
}
