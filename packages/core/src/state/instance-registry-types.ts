/** Minimal interface for scanInstances to use registry without circular dependency. */
export interface InstanceRegistryAdapter {
  list(): Iterable<{ name: string; workspacePath: string; status: string }>;
}
