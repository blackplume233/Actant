export const HUB_PATH_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["/_project.json", "/hub/_project.json"],
  ["/projects", "/hub/projects"],
  ["/project", "/hub/project"],
  ["/workspace", "/hub/workspace"],
  ["/config", "/hub/config"],
  ["/skills", "/hub/skills"],
  ["/agents", "/hub/agents"],
  ["/mcp/configs", "/hub/mcp/configs"],
  ["/mcp/runtime", "/hub/mcp/runtime"],
  ["/prompts", "/hub/prompts"],
  ["/mcp", "/hub/mcp"],
  ["/workflows", "/hub/workflows"],
  ["/templates", "/hub/templates"],
] as const;

export const HUB_MOUNT_LAYOUT = {
  project: "/hub/project",
  workspace: "/hub/workspace",
  config: "/hub/config",
  skills: "/hub/skills",
  agents: "/hub/agents",
  mcpConfigs: "/hub/mcp/configs",
  mcpRuntime: "/hub/mcp/runtime",
  mcpLegacy: "/hub/mcp",
  prompts: "/hub/prompts",
  workflows: "/hub/workflows",
  templates: "/hub/templates",
} as const;

export function mapHubPath(path: string): string {
  for (const [from, to] of HUB_PATH_ALIASES) {
    if (path === from || path.startsWith(`${from}/`)) {
      return `${to}${path.slice(from.length)}`;
    }
  }

  return path;
}
