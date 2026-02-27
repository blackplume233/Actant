import type { AgentInstanceMeta } from "@actant/shared";
import type { ActantToolDefinition, ContextProvider, ToolScope } from "./session-context-injector";
import { loadTemplate, renderTemplate } from "../prompts/template-engine";

/**
 * Provides canvas-related tools and system context for managed agents.
 * Repo-tier agents are excluded (canvas requires at least service archetype).
 */
export class CanvasContextProvider implements ContextProvider {
  readonly name = "canvas";

  getTools(_agentName: string, meta: AgentInstanceMeta): ActantToolDefinition[] {
    if (meta.archetype === "repo") return [];
    return [
      {
        name: "actant_canvas_update",
        description: "Update the agent's live HTML canvas displayed on the dashboard",
        parameters: {
          html: { type: "string", description: "HTML content to render" },
          title: { type: "string", description: "Optional canvas title" },
        },
        rpcMethod: "canvas.update",
        scope: "service" as ToolScope,
        context: "Use this to display progress reports, visualizations, or status dashboards as HTML.",
      },
      {
        name: "actant_canvas_clear",
        description: "Clear the agent's live HTML canvas",
        parameters: {},
        rpcMethod: "canvas.clear",
        scope: "service" as ToolScope,
      },
    ];
  }

  getSystemContext(_agentName: string, meta: AgentInstanceMeta): string | undefined {
    if (meta.archetype === "repo") return undefined;
    return renderTemplate(loadTemplate("canvas-context.md"), {}).trim();
  }
}
