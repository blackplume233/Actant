/**
 * Agent Instance = a workspace directory.
 * `.agentcraft.json` is the metadata descriptor of that directory.
 * The directory itself IS the instance — containing materialized Domain Context files.
 */
export interface AgentInstanceMeta {
  id: string;
  name: string;
  templateName: string;
  templateVersion: string;
  status: AgentStatus;
  launchMode: LaunchMode;
  createdAt: string;
  updatedAt: string;
  pid?: number;
  metadata?: Record<string, string>;
}

export type AgentStatus =
  | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

export type LaunchMode =
  | "direct"
  | "acp-background"
  | "acp-service"
  | "one-shot";
