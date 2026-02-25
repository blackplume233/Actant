import { createLogger } from "@actant/shared";
import type { WorkflowDefinition, HookDeclaration } from "@actant/shared";
import { HookEventBus, type HookEventPayload } from "./hook-event-bus";
import { runActions, type ActionContext, type ActionResult } from "./action-runner";

const logger = createLogger("hook-registry");

interface RegisteredHook {
  workflowName: string;
  level: "actant" | "instance";
  /** For instance-level hooks, the bound agent name. */
  agentName?: string;
  declaration: HookDeclaration;
}

/**
 * Manages the lifecycle of workflow hooks: registration, event binding, and teardown.
 *
 * Actant-level workflows are registered globally.
 * Instance-level workflows are bound to a specific agent and only fire
 * when the event payload's agentName matches.
 */
export class HookRegistry {
  private readonly hooks: RegisteredHook[] = [];
  private readonly listenerRefs = new Map<RegisteredHook, (p: HookEventPayload) => void>();

  constructor(
    private readonly eventBus: HookEventBus,
    private readonly actionCtx: ActionContext,
  ) {}

  /**
   * Register all hooks from a workflow definition.
   * For instance-level workflows, `agentName` is required.
   */
  registerWorkflow(workflow: WorkflowDefinition, agentName?: string): void {
    if (!workflow.hooks?.length) return;
    if (workflow.enabled === false) return;

    const level = workflow.level ?? "actant";
    if (level === "instance" && !agentName) {
      logger.warn({ workflow: workflow.name }, "Instance-level workflow requires agentName, skipping");
      return;
    }

    for (const declaration of workflow.hooks) {
      const hook: RegisteredHook = {
        workflowName: workflow.name,
        level,
        agentName: level === "instance" ? agentName : undefined,
        declaration,
      };

      const listener = (payload: HookEventPayload) => {
        if (level === "instance" && payload.agentName !== agentName) return;

        if (declaration.allowedCallers?.length) {
          if (!declaration.allowedCallers.includes(payload.callerType)) {
            logger.debug(
              { workflow: workflow.name, event: declaration.on, callerType: payload.callerType },
              "Hook skipped: caller type not in allowedCallers",
            );
            return;
          }
        }

        runActions(declaration.actions, payload, this.actionCtx)
          .then((results: ActionResult[]) => {
            const failed = results.filter((r) => !r.success);
            if (failed.length > 0) {
              logger.warn({ workflow: workflow.name, event: declaration.on, failures: failed.length }, "Some hook actions failed");
            }
          })
          .catch((err) => {
            logger.error({ workflow: workflow.name, event: declaration.on, error: err }, "Hook action runner error");
          });
      };

      this.eventBus.on(declaration.on, listener);
      this.hooks.push(hook);
      this.listenerRefs.set(hook, listener);
    }

    logger.info({ workflow: workflow.name, level, agentName, hookCount: workflow.hooks.length }, "Workflow hooks registered");
  }

  /** Unregister all hooks from a specific workflow. */
  unregisterWorkflow(workflowName: string, agentName?: string): void {
    const toRemove = this.hooks.filter(
      (h) => h.workflowName === workflowName && (agentName === undefined || h.agentName === agentName),
    );

    for (const hook of toRemove) {
      const listener = this.listenerRefs.get(hook);
      if (listener) {
        this.eventBus.off(hook.declaration.on, listener);
        this.listenerRefs.delete(hook);
      }
    }

    const remaining = this.hooks.filter(
      (h) => !(h.workflowName === workflowName && (agentName === undefined || h.agentName === agentName)),
    );
    this.hooks.length = 0;
    this.hooks.push(...remaining);

    if (toRemove.length > 0) {
      logger.info({ workflowName, agentName, removed: toRemove.length }, "Workflow hooks unregistered");
    }
  }

  /** Unregister all hooks bound to a specific agent. */
  unregisterAgent(agentName: string): void {
    const toRemove = this.hooks.filter((h) => h.agentName === agentName);
    for (const hook of toRemove) {
      const listener = this.listenerRefs.get(hook);
      if (listener) {
        this.eventBus.off(hook.declaration.on, listener);
        this.listenerRefs.delete(hook);
      }
    }
    const remaining = this.hooks.filter((h) => h.agentName !== agentName);
    this.hooks.length = 0;
    this.hooks.push(...remaining);

    if (toRemove.length > 0) {
      logger.info({ agentName, removed: toRemove.length }, "Agent hooks unregistered");
    }
  }

  /** List all registered hooks (for debugging / CLI). */
  listHooks(): { workflowName: string; level: string; agentName?: string; event: string; description?: string; allowedCallers?: string[] }[] {
    return this.hooks.map((h) => ({
      workflowName: h.workflowName,
      level: h.level,
      agentName: h.agentName,
      event: h.declaration.on,
      description: h.declaration.description,
      allowedCallers: h.declaration.allowedCallers,
    }));
  }

  get hookCount(): number {
    return this.hooks.length;
  }

  dispose(): void {
    for (const [hook, listener] of this.listenerRefs) {
      this.eventBus.off(hook.declaration.on, listener);
    }
    this.hooks.length = 0;
    this.listenerRefs.clear();
  }
}
