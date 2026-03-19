import type { McpServerDefinition, McpServerRef } from "@actant/shared";
import type { ComponentTypeHandler } from "../component-type-handler";
import type { BackendBuilder } from "../backend-builder";

function isMcpServerRef(obj: unknown): obj is McpServerRef {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "command" in obj &&
    typeof (obj as McpServerRef).name === "string" &&
    typeof (obj as McpServerRef).command === "string"
  );
}

export const mcpServersHandler: ComponentTypeHandler<McpServerDefinition> = {
  contextKey: "mcpServers",
  resolve(refs, manager) {
    if (!refs || !Array.isArray(refs) || refs.length === 0) return [];
    const arr = refs as unknown[];
    if (arr.every(isMcpServerRef)) {
      return arr.map((ref) => ({
        name: ref.name,
        command: ref.command,
        args: ref.args,
        env: ref.env,
      })) as McpServerDefinition[];
    }
    return (manager?.resolve(arr as string[]) ?? []) as McpServerDefinition[];
  },
  async materialize(workspaceDir, definitions, _backendType, builder) {
    await (builder as BackendBuilder).materializeMcpConfig(workspaceDir, definitions);
  },
};
