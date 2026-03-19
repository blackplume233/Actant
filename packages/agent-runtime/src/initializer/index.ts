/**
 * Phase B migration: AgentInitializer splits — context-building steps
 * (DomainManagers, WorkspaceBuilder) move to `@actant/context`, while
 * process-launch steps stay in `@actant/agent-runtime`.
 */
export { AgentInitializer, type InitializerOptions, type InstanceOverrides } from "./agent-initializer";
export { getArchetypeDefaults, type ArchetypeDefaults } from "./archetype-defaults";
export type { DomainManagers } from "../builder/workspace-builder";
export {
  InitializerStepExecutor,
  StepRegistry,
  InitializationPipeline,
  type StepContext,
  type StepResult,
  type StepValidationResult,
  type PipelineOptions,
  type PipelineResult,
} from "./pipeline/index";
export {
  MkdirStep,
  ExecStep,
  FileCopyStep,
  GitCloneStep,
  NpmInstallStep,
  FileTemplateStep,
  WriteFileStep,
  createDefaultStepRegistry,
} from "./steps/index";
