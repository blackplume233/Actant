import type { BackendDefinition, MaterializationSpec, ModelProviderConfig } from "@actant/shared";
import { getBackendManager } from "./backend-registry";
import { modelProviderRegistry } from "../../provider/model-provider-registry";

// ---------------------------------------------------------------------------
// Materialization specs for built-in backends (#150)
// ---------------------------------------------------------------------------

const CURSOR_MATERIALIZATION: MaterializationSpec = {
  configDir: ".cursor",
  scaffoldDirs: [".cursor/rules", "prompts"],
  components: {
    skills: {
      mode: "dual",
      outputDir: ".cursor/rules",
      extension: ".mdc",
      frontmatterTemplate: 'description: "{{description}}"\nalwaysApply: true',
    },
    prompts: { mode: "merged", output: "prompts/system.md" },
    mcpServers: { enabled: true, outputFile: ".cursor/mcp.json" },
    plugins: { enabled: true, outputFile: ".cursor/extensions.json", format: "recommendations" },
    permissions: { mode: "best-effort", outputFile: ".cursor/settings.json" },
    workflow: { outputFile: ".trellis/workflow.md" },
  },
  verifyChecks: [
    { path: ".cursor", type: "dir", severity: "warning" },
    { path: "AGENTS.md", type: "file", severity: "warning" },
  ],
};

const CLAUDE_CODE_MATERIALIZATION: MaterializationSpec = {
  configDir: ".claude",
  scaffoldDirs: [".claude", "prompts"],
  components: {
    skills: {
      mode: "single-file",
      aggregateFiles: [
        { path: "AGENTS.md", format: "agents-md" },
        { path: "CLAUDE.md", format: "claude-md" },
      ],
    },
    prompts: { mode: "merged", output: "prompts/system.md" },
    mcpServers: { enabled: true, outputFile: ".claude/mcp.json" },
    plugins: { enabled: true, outputFile: ".claude/plugins.json", format: "entries" },
    permissions: { mode: "full", outputFile: ".claude/settings.local.json" },
    workflow: { outputFile: ".trellis/workflow.md" },
  },
  verifyChecks: [
    { path: ".claude", type: "dir", severity: "warning" },
    { path: "AGENTS.md", type: "file", severity: "warning" },
    { path: "CLAUDE.md", type: "file", severity: "warning" },
  ],
};

const CUSTOM_MATERIALIZATION: MaterializationSpec = {
  ...CURSOR_MATERIALIZATION,
};

const PI_MATERIALIZATION: MaterializationSpec = {
  configDir: ".pi",
  scaffoldDirs: [".pi/skills", ".pi/prompts"],
  components: {
    skills: { mode: "dual", outputDir: ".pi/skills", extension: ".md" },
    prompts: { mode: "per-file", output: ".pi/prompts" },
    mcpServers: { enabled: false },
    plugins: { enabled: false },
    permissions: { mode: "tools-only", outputFile: ".pi/settings.json" },
    workflow: { outputFile: ".trellis/workflow.md" },
  },
  verifyChecks: [{ path: "AGENTS.md", type: "file", severity: "error" }],
};

// ---------------------------------------------------------------------------
// Built-in backend definitions
// ---------------------------------------------------------------------------

const BUILTIN_BACKENDS: BackendDefinition[] = [
  {
    name: "cursor",
    version: "1.0.0",
    description: "Cursor IDE",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "open"],
    defaultInteractionModes: ["open"],
    resolveCommand: { win32: "cursor.cmd", default: "cursor" },
    openCommand: { win32: "cursor.cmd", default: "cursor" },
    openSpawnOptions: { shell: process.platform === "win32" },
    existenceCheck: { command: "cursor", args: ["--version"] },
    install: [
      { type: "url", package: "https://cursor.com", label: "Download Cursor", platforms: ["win32", "darwin", "linux"] },
      { type: "brew", package: "cursor", label: "brew install --cask cursor", platforms: ["darwin"] },
      { type: "winget", package: "Anysphere.Cursor", label: "winget install Anysphere.Cursor", platforms: ["win32"] },
    ],
    materialization: CURSOR_MATERIALIZATION,
  },
  {
    name: "cursor-agent",
    version: "1.0.0",
    description: "Cursor Agent (TUI)",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "open", "acp"],
    defaultInteractionModes: ["open", "start", "chat", "run", "proxy"],
    resolveCommand: { win32: "agent", default: "agent" },
    openCommand: { win32: "agent", default: "agent" },
    openWorkspaceDir: "cwd",
    openSpawnOptions: { stdio: "inherit", detached: false, windowsHide: false },
    existenceCheck: { command: "agent", args: ["--version"] },
    install: [
      { type: "manual", label: "Included with Cursor", instructions: "Install Cursor from https://cursor.com — the `agent` CLI is bundled." },
    ],
    materialization: CURSOR_MATERIALIZATION,
  },
  {
    name: "claude-code",
    version: "1.0.0",
    description: "Claude Code CLI",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "open", "acp"],
    defaultInteractionModes: ["open", "start", "chat", "run", "proxy"],
    resolveCommand: { win32: "claude-agent-acp.cmd", default: "claude-agent-acp" },
    openCommand: { win32: "claude.exe", default: "claude" },
    openWorkspaceDir: "cwd",
    openSpawnOptions: { stdio: "inherit", detached: false, windowsHide: false },
    resolvePackage: "@zed-industries/claude-agent-acp",
    existenceCheck: { command: "claude", args: ["--version"] },
    install: [
      { type: "npm", package: "@anthropic-ai/claude-code", label: "npm install -g @anthropic-ai/claude-code" },
    ],
    materialization: CLAUDE_CODE_MATERIALIZATION,
  },
  {
    name: "custom",
    version: "1.0.0",
    description: "Custom backend (user-provided executable)",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "acp"],
    defaultInteractionModes: ["start"],
    materialization: CUSTOM_MATERIALIZATION,
  },
  {
    name: "pi",
    version: "1.0.0",
    description: "Pi — lightweight agent backend powered by local/cloud LLMs",
    tags: ["agent", "in-process", "llm"],
    origin: { type: "builtin" },
    supportedModes: ["resolve", "acp"],
    defaultInteractionModes: ["start", "chat", "run", "proxy"],
    resolveCommand: { win32: "pi-acp-bridge.cmd", default: "pi-acp-bridge" },
    resolvePackage: "@actant/pi",
    install: [
      { type: "manual", label: "Included with Actant", instructions: "Pi is bundled with Actant — no separate installation required." },
    ],
    materialization: PI_MATERIALIZATION,
  },
];

// ---------------------------------------------------------------------------
// Backend-specific provider env builders (#141 Phase 2)
// ---------------------------------------------------------------------------

/**
 * Claude Code (third-party binary) expects native Anthropic env vars.
 * SECURITY: apiKey is resolved from the in-memory registry only.
 */
function buildClaudeCodeProviderEnv(
  providerConfig: ModelProviderConfig | undefined,
): Record<string, string> {
  const env: Record<string, string> = {};

  const defaultDesc = modelProviderRegistry.getDefault();
  const providerType = providerConfig?.type ?? defaultDesc?.type;
  const descriptor = providerType ? modelProviderRegistry.get(providerType) : defaultDesc;

  const apiKey = descriptor?.apiKey ?? process.env["ACTANT_API_KEY"];
  if (apiKey) {
    env["ANTHROPIC_API_KEY"] = apiKey;
  }

  const baseUrl = providerConfig?.baseUrl ?? descriptor?.defaultBaseUrl;
  if (baseUrl) {
    env["ANTHROPIC_BASE_URL"] = baseUrl;
  }

  return env;
}

export function registerBuiltinBackends(): void {
  const mgr = getBackendManager();
  for (const def of BUILTIN_BACKENDS) {
    mgr.register(def);
  }

  mgr.registerBuildProviderEnv("claude-code", buildClaudeCodeProviderEnv);
}

registerBuiltinBackends();
