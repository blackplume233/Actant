import type {
  HostProfile,
  HostRuntimeState,
  HubActivateResult,
  HubStatusResult,
  VfsMountRegistration,
} from "@actant/shared";
import { HUB_MOUNT_LAYOUT } from "@actant/shared";
import {
  createProjectContextPermissionRules,
  createProjectContextSourceTypeRegistry,
  createProjectContextRegistrations,
  loadProjectContext,
  type LoadedProjectContext,
} from "./project-context";
import type { AppContext } from "./app-context";
import { DEFAULT_PERMISSION_RULES } from "@actant/agent-runtime";

export interface ActiveHubContext {
  projectRoot: string;
  projectName: string;
  configPath: string | null;
  configsDir: string;
  catalogWarnings: string[];
  components: HubActivateResult["components"];
  mounts: HubActivateResult["mounts"];
  mountNames: string[];
}

export class HubContextService {
  private readonly filesystemTypeRegistry = createProjectContextSourceTypeRegistry();
  private active?: ActiveHubContext;
  private activationPromise?: Promise<HubActivateResult>;
  private activationTargetRoot?: string;

  constructor(private readonly appContext: AppContext) {}

  async activate(projectDir?: string): Promise<HubActivateResult> {
    const targetRoot = projectDir ? await resolveProjectRoot(projectDir) : undefined;
    if (targetRoot && this.active?.projectRoot === targetRoot) {
      return this.toActivateResult(this.active);
    }

    if (this.activationPromise) {
      if (targetRoot && targetRoot === this.activationTargetRoot) {
        return this.activationPromise;
      }

      await this.activationPromise;
      if (targetRoot && this.active?.projectRoot === targetRoot) {
        return this.toActivateResult(this.active);
      }
    }

    this.activationTargetRoot = targetRoot;
    this.activationPromise = this.doActivate(targetRoot ?? projectDir);
    try {
      return await this.activationPromise;
    } finally {
      this.activationPromise = undefined;
      this.activationTargetRoot = undefined;
    }
  }

  status(hostProfile: HostProfile, runtimeState: HostRuntimeState): HubStatusResult {
    if (!this.active) {
      return {
        active: false,
        hostProfile,
        runtimeState,
        mounts: HUB_MOUNT_LAYOUT,
      };
    }
    return {
      active: true,
      hostProfile,
      runtimeState,
      projectRoot: this.active.projectRoot,
      projectName: this.active.projectName,
      configPath: this.active.configPath,
      configsDir: this.active.configsDir,
        catalogWarnings: this.active.catalogWarnings,
      components: this.active.components,
      mounts: this.active.mounts,
    };
  }

  getActiveProject(): ActiveHubContext | undefined {
    return this.active;
  }

  private async doActivate(projectDir?: string): Promise<HubActivateResult> {
    const context = await loadProjectContext(projectDir);
    const registrations = buildHubRegistrations(context, this.filesystemTypeRegistry);
    this.appContext.vfsPermissionManager.setRules([
      ...DEFAULT_PERMISSION_RULES,
      ...createProjectContextPermissionRules(context, { project: HUB_MOUNT_LAYOUT.project }),
    ]);
    await this.replaceActiveContext(registrations);

    const next: ActiveHubContext = {
      projectRoot: context.projectRoot,
      projectName: context.summary.projectName,
      configPath: context.configPath,
      configsDir: context.configsDir,
      catalogWarnings: context.summary.catalogWarnings,
      components: context.summary.components,
      mounts: HUB_MOUNT_LAYOUT,
      mountNames: registrations.map((registration) => registration.name),
    };
    this.active = next;
    return this.toActivateResult(next);
  }

  private async replaceActiveContext(registrations: VfsMountRegistration[]): Promise<void> {
    for (const name of this.active?.mountNames ?? []) {
      this.appContext.vfsRegistry.unmount(name);
    }
    for (const registration of registrations) {
      this.appContext.vfsRegistry.mount(registration);
    }
  }

  private toActivateResult(active: ActiveHubContext): HubActivateResult {
    return {
      projectRoot: active.projectRoot,
      projectName: active.projectName,
      configPath: active.configPath,
      configsDir: active.configsDir,
      catalogWarnings: active.catalogWarnings,
      components: active.components,
      mounts: active.mounts,
    };
  }
}

function buildHubRegistrations(
  context: LoadedProjectContext,
  factoryRegistry: ReturnType<typeof createProjectContextSourceTypeRegistry>,
): VfsMountRegistration[] {
  return createProjectContextRegistrations(
    context,
    factoryRegistry,
    HUB_MOUNT_LAYOUT,
    { type: "manual" },
    {
      namePrefix: "hub",
      workspaceReadOnly: true,
      configReadOnly: true,
    },
  );
}

async function resolveProjectRoot(projectDir: string): Promise<string> {
  const { resolve } = await import("node:path");
  return resolve(projectDir);
}
