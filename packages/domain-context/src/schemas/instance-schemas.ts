import { z } from "zod/v4";

export const AgentStatusSchema = z.enum([
  "created",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
  "crashed",
]);

export const LaunchModeSchema = z.enum([
  "direct",
  "acp-background",
  "acp-service",
  "one-shot",
]);

export const AgentArchetypeSchema = z.enum(["repo", "service", "employee"]).or(
  z.literal("tool").transform(() => "repo" as const),
);

export const ProcessOwnershipSchema = z.enum(["managed", "external"]);

export const WorkspacePolicySchema = z.enum(["persistent", "ephemeral"]);
