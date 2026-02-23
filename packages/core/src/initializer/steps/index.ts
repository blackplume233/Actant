import { StepRegistry } from "../pipeline/step-registry";
import { MkdirStep } from "./mkdir-step";
import { ExecStep } from "./exec-step";
import { FileCopyStep } from "./file-copy-step";
import { GitCloneStep } from "./git-clone-step";
import { NpmInstallStep } from "./npm-install-step";

export { MkdirStep } from "./mkdir-step";
export { ExecStep } from "./exec-step";
export { FileCopyStep } from "./file-copy-step";
export { GitCloneStep } from "./git-clone-step";
export { NpmInstallStep } from "./npm-install-step";

/**
 * Create a StepRegistry pre-loaded with all built-in step executors.
 */
export function createDefaultStepRegistry(): StepRegistry {
  const registry = new StepRegistry();
  registry.register(new MkdirStep());
  registry.register(new ExecStep());
  registry.register(new FileCopyStep());
  registry.register(new GitCloneStep());
  registry.register(new NpmInstallStep());
  return registry;
}
