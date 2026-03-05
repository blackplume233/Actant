import type { AgentInstanceMeta, VfsCapabilityId } from "@actant/shared";
import type { ContextProvider } from "../context-injector/session-context-injector";
import type { VfsRegistry } from "./vfs-registry";

/**
 * Injects VFS mount point information into the agent's system context.
 *
 * When an ACP session starts, this provider generates a summary of all
 * available VFS mount points and their capabilities, so the agent knows
 * what virtual paths it can access using standard Read/Write operations.
 */
export class VfsContextProvider implements ContextProvider {
  readonly name = "vfs";

  constructor(private registry: VfsRegistry) {}

  getSystemContext(_agentName: string, _meta: AgentInstanceMeta): string | undefined {
    const mounts = this.registry.listMounts();
    if (mounts.length === 0) return undefined;

    const lines: string[] = [
      "## Virtual File System (VFS)",
      "",
      "You have access to a unified virtual file system. Use standard Read/Write operations to access virtual paths.",
      "",
      "### Available Mount Points",
    ];

    for (const mount of mounts) {
      const caps = formatCapabilities(mount.capabilities);
      const padded = mount.mountPoint.padEnd(28);
      const typePadded = mount.sourceType.padEnd(16);
      lines.push(`  ${padded} ${typePadded} [${caps}]`);
    }

    lines.push("");
    lines.push("### Quick Reference");
    lines.push('  Read("/proc/<agent>/<pid>/stdout")       -- read process output');
    lines.push('  Read("/memory/<agent>/notes.md")         -- read agent memory');
    lines.push('  Write("/proc/<agent>/<pid>/cmd", "stop") -- send command to process');
    lines.push('  Read("/vcs/status")                      -- git status');
    lines.push('  Read("/config/template.json")            -- read configuration');

    return lines.join("\n");
  }
}

function formatCapabilities(caps: VfsCapabilityId[]): string {
  if (caps.length <= 5) return caps.join(", ");
  return caps.slice(0, 4).join(", ") + ", ...";
}
