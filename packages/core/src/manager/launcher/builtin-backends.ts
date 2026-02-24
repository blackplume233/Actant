import type { BackendDefinition } from "@actant/shared";
import { getBackendManager } from "./backend-registry";

/**
 * Built-in backend definitions.
 * Pure data — no functions, no runtime dependencies.
 * These are registered as `origin: "builtin"` VersionedComponents.
 */
const BUILTIN_BACKENDS: BackendDefinition[] = [
  {
    name: "cursor",
    version: "1.0.0",
    description: "Cursor IDE",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "open"],
    resolveCommand: { win32: "cursor.cmd", default: "cursor" },
    openCommand: { win32: "cursor.cmd", default: "cursor" },
    openSpawnOptions: { shell: process.platform === "win32" },
    existenceCheck: { command: "cursor", args: ["--version"] },
    install: [
      { type: "url", package: "https://cursor.com", label: "Download Cursor", platforms: ["win32", "darwin", "linux"] },
      { type: "brew", package: "cursor", label: "brew install --cask cursor", platforms: ["darwin"] },
      { type: "winget", package: "Anysphere.Cursor", label: "winget install Anysphere.Cursor", platforms: ["win32"] },
    ],
  },
  {
    name: "cursor-agent",
    version: "1.0.0",
    description: "Cursor Agent (TUI)",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "open", "acp"],
    resolveCommand: { win32: "agent", default: "agent" },
    openCommand: { win32: "agent", default: "agent" },
    openWorkspaceDir: "cwd",
    openSpawnOptions: { stdio: "inherit", detached: false, windowsHide: false },
    existenceCheck: { command: "agent", args: ["--version"] },
    install: [
      { type: "manual", label: "Included with Cursor", instructions: "Install Cursor from https://cursor.com — the `agent` CLI is bundled." },
    ],
  },
  {
    name: "claude-code",
    version: "1.0.0",
    description: "Claude Code CLI",
    origin: { type: "builtin" },
    supportedModes: ["resolve", "open", "acp"],
    resolveCommand: { win32: "claude-agent-acp.cmd", default: "claude-agent-acp" },
    openCommand: { win32: "claude.exe", default: "claude" },
    openWorkspaceDir: "cwd",
    openSpawnOptions: { stdio: "inherit", detached: false, windowsHide: false },
    resolvePackage: "@zed-industries/claude-agent-acp",
    existenceCheck: { command: "claude", args: ["--version"] },
    install: [
      { type: "npm", package: "@anthropic-ai/claude-code", label: "npm install -g @anthropic-ai/claude-code" },
    ],
  },
  {
    name: "custom",
    version: "1.0.0",
    description: "Custom backend (user-provided executable)",
    origin: { type: "builtin" },
    supportedModes: ["resolve"],
  },
];

export function registerBuiltinBackends(): void {
  const mgr = getBackendManager();
  for (const def of BUILTIN_BACKENDS) {
    mgr.register(def);
  }
}

registerBuiltinBackends();
