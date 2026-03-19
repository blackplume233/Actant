export type ComponentTypeName = "skill" | "prompt" | "workflow" | "mcpServer" | "plugin" | "template" | "preset";

export interface ComponentVersionDelta {
  type: ComponentTypeName;
  name: string;
  oldVersion?: string;
  newVersion?: string;
}

export interface SyncReport {
  added: ComponentVersionDelta[];
  updated: ComponentVersionDelta[];
  removed: ComponentVersionDelta[];
  unchanged: string[];
  hasBreakingChanges: boolean;
}

export function createEmptySyncReport(): SyncReport {
  return { added: [], updated: [], removed: [], unchanged: [], hasBreakingChanges: false };
}

/** Merge multiple SyncReports into one (e.g. when syncing all sources). */
export function mergeSyncReports(reports: SyncReport[]): SyncReport {
  const merged = createEmptySyncReport();
  for (const r of reports) {
    merged.added.push(...r.added);
    merged.updated.push(...r.updated);
    merged.removed.push(...r.removed);
    merged.unchanged.push(...r.unchanged);
    if (r.hasBreakingChanges) merged.hasBreakingChanges = true;
  }
  return merged;
}
