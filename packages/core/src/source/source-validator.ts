/**
 * Source Validator — recursively validates all assets in a component source.
 * Checks: manifest integrity, component schema conformance, file reference
 * existence, cross-component reference consistency, and template semantics.
 */
import { readFile, readdir, stat, access } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { ZodSchema } from "zod";
import {
  PackageManifestSchema,
  SkillDefinitionSchema,
  PromptDefinitionSchema,
  McpServerDefinitionSchema,
  WorkflowDefinitionSchema,
  PresetDefinitionSchema,
  type ComponentType,
} from "./source-schemas";
import { AgentTemplateSchema } from "../template/schema/template-schema";
import { validateTemplate } from "../template/schema/config-validators";
import { parseSkillMdContent } from "./skill-md-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceValidationIssue {
  severity: "error" | "warning" | "info";
  path: string;
  component?: string;
  message: string;
  code?: string;
}

export interface SourceValidationReport {
  valid: boolean;
  sourceName: string;
  rootDir: string;
  summary: { pass: number; warn: number; error: number };
  issues: SourceValidationIssue[];
}

export type CompatMode = "agent-skills";

export interface ValidateOptions {
  strict?: boolean;
  /** Enable compatibility checks against an external standard. */
  compat?: CompatMode;
  /** Treat the source as a community repo — skip manifest requirement, scan for SKILL.md recursively. */
  community?: boolean;
}

// ---------------------------------------------------------------------------
// Component type → Zod schema mapping
// ---------------------------------------------------------------------------

const COMPONENT_DIR_SCHEMAS: Record<string, ZodSchema> = {
  skills: SkillDefinitionSchema,
  prompts: PromptDefinitionSchema,
  mcp: McpServerDefinitionSchema,
  workflows: WorkflowDefinitionSchema,
  presets: PresetDefinitionSchema,
};

const COMPONENT_DIRS: ComponentType[] = ["skills", "prompts", "mcp", "workflows", "templates", "presets"];

// ---------------------------------------------------------------------------
// SourceValidator
// ---------------------------------------------------------------------------

export class SourceValidator {
  /**
   * Validate all assets in a source directory.
   * Returns a report with pass/warn/error counts and detailed issues.
   */
  async validate(rootDir: string, options?: ValidateOptions): Promise<SourceValidationReport> {
    const issues: SourceValidationIssue[] = [];
    let passCount = 0;
    const validatedFiles = new Set<string>();
    const compat = options?.compat;

    if (options?.community) {
      passCount += await this.validateCommunitySource(rootDir, issues, compat);
      const errorCount = issues.filter((i) => i.severity === "error").length;
      const warnCount = issues.filter((i) => i.severity === "warning").length;
      const valid = options?.strict
        ? errorCount === 0 && warnCount === 0
        : errorCount === 0;
      return {
        valid,
        sourceName: rootDir.split(/[\\/]/).pop() ?? "community",
        rootDir,
        summary: { pass: passCount, warn: warnCount, error: errorCount },
        issues,
      };
    }

    // Layer 1: Manifest
    const manifest = await this.validateManifest(rootDir, issues);
    if (manifest) passCount++;

    // Layer 2: Components (explicit from manifest + directory scan)
    const componentNames = new Map<string, Set<string>>();
    if (manifest) {
      passCount += await this.validateExplicitFiles(rootDir, manifest, issues, componentNames, validatedFiles, compat);
    }
    passCount += await this.validateComponentDirs(rootDir, issues, componentNames, validatedFiles, compat);

    // Layer 3: Cross-references (presets referencing components)
    await this.validatePresetReferences(rootDir, manifest, componentNames, issues);

    // Layer 4: Template deep validation (already covered in component scan)

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warnCount = issues.filter((i) => i.severity === "warning").length;

    const valid = options?.strict
      ? errorCount === 0 && warnCount === 0
      : errorCount === 0;

    return {
      valid,
      sourceName: (manifest?.name as string) ?? "unknown",
      rootDir,
      summary: { pass: passCount, warn: warnCount, error: errorCount },
      issues,
    };
  }

  // -------------------------------------------------------------------------
  // Layer 1: Manifest validation
  // -------------------------------------------------------------------------

  private async validateManifest(
    rootDir: string,
    issues: SourceValidationIssue[],
  ): Promise<Record<string, unknown> | null> {
    const manifestPath = join(rootDir, "actant.json");
    let raw: string;

    try {
      raw = await readFile(manifestPath, "utf-8");
    } catch {
      issues.push({
        severity: "error",
        path: "actant.json",
        message: "actant.json not found in source root",
        code: "MANIFEST_MISSING",
      });
      return null;
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      issues.push({
        severity: "error",
        path: "actant.json",
        message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        code: "MANIFEST_INVALID_JSON",
      });
      return null;
    }

    const result = PackageManifestSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          severity: "error",
          path: "actant.json",
          message: `${issue.path.join(".")}: ${issue.message}`,
          code: "MANIFEST_SCHEMA",
        });
      }
      return null;
    }

    // Verify file references exist
    const manifest = result.data;
    await this.verifyManifestFileRefs(rootDir, manifest, issues);

    return manifest as Record<string, unknown>;
  }

  private async verifyManifestFileRefs(
    rootDir: string,
    manifest: { components?: Record<string, string[]>; presets?: string[] },
    issues: SourceValidationIssue[],
  ): Promise<void> {
    const allRefs: Array<{ ref: string; section: string }> = [];

    if (manifest.components) {
      for (const [type, files] of Object.entries(manifest.components)) {
        if (files) {
          for (const f of files) {
            allRefs.push({ ref: f, section: `components.${type}` });
          }
        }
      }
    }
    if (manifest.presets) {
      for (const f of manifest.presets) {
        allRefs.push({ ref: f, section: "presets" });
      }
    }

    for (const { ref, section } of allRefs) {
      const fullPath = join(rootDir, ref);
      try {
        await access(fullPath);
      } catch {
        issues.push({
          severity: "error",
          path: `actant.json`,
          component: ref,
          message: `File referenced in ${section} does not exist: ${ref}`,
          code: "MANIFEST_FILE_MISSING",
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2a: Validate files explicitly listed in manifest
  // -------------------------------------------------------------------------

  private async validateExplicitFiles(
    rootDir: string,
    manifest: Record<string, unknown>,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
    validatedFiles: Set<string>,
    compat?: CompatMode,
  ): Promise<number> {
    let passCount = 0;
    const components = manifest.components as Record<string, string[]> | undefined;
    if (!components && !manifest.presets) return 0;

    if (components) {
      for (const [type, files] of Object.entries(components)) {
        if (!files) continue;
        for (const filePath of files) {
          validatedFiles.add(filePath);
          const ok = await this.validateSingleFile(rootDir, filePath, type as ComponentType, issues, componentNames);
          if (ok) passCount++;
        }
      }
    }

    const presets = manifest.presets as string[] | undefined;
    if (presets) {
      for (const filePath of presets) {
        validatedFiles.add(filePath);
        const ok = await this.validateSingleFile(rootDir, filePath, "presets", issues, componentNames);
        if (ok) passCount++;
      }
    }

    // compat parameter reserved for future explicit-file compat checks
    void compat;
    return passCount;
  }

  // -------------------------------------------------------------------------
  // Layer 2b: Scan component directories
  // -------------------------------------------------------------------------

  private async validateComponentDirs(
    rootDir: string,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
    validatedFiles: Set<string>,
    compat?: CompatMode,
  ): Promise<number> {
    let passCount = 0;

    for (const dir of COMPONENT_DIRS) {
      const dirPath = join(rootDir, dir);
      try {
        const dirStat = await stat(dirPath);
        if (!dirStat.isDirectory()) continue;
      } catch {
        continue;
      }

      passCount += await this.scanDirectory(rootDir, dirPath, dir, issues, componentNames, validatedFiles, compat);
    }

    return passCount;
  }

  private async scanDirectory(
    rootDir: string,
    dirPath: string,
    componentType: ComponentType,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
    validatedFiles: Set<string>,
    compat?: CompatMode,
  ): Promise<number> {
    let passCount = 0;
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
      const entryStat = await stat(fullPath).catch(() => null);
      if (!entryStat) continue;

      if (entryStat.isFile() && extname(entry) === ".json") {
        if (validatedFiles.has(relPath)) continue;
        validatedFiles.add(relPath);
        const ok = await this.validateSingleFile(rootDir, relPath, componentType, issues, componentNames);
        if (ok) passCount++;
      } else if (entryStat.isDirectory()) {
        if (componentType === "skills") {
          const skillMdPath = join(fullPath, "SKILL.md");
          try {
            await access(skillMdPath);
            const skillRelPath = relative(rootDir, skillMdPath).replace(/\\/g, "/");
            if (!validatedFiles.has(skillRelPath)) {
              validatedFiles.add(skillRelPath);
              const ok = await this.validateSkillMd(rootDir, skillRelPath, issues, componentNames, entry, compat);
              if (ok) passCount++;
            }
            if (compat === "agent-skills") {
              await this.validateSkillDirConventions(rootDir, fullPath, entry, issues);
            }
          } catch {
            const manifestJsonPath = join(fullPath, "manifest.json");
            try {
              await access(manifestJsonPath);
              const mRelPath = relative(rootDir, manifestJsonPath).replace(/\\/g, "/");
              if (!validatedFiles.has(mRelPath)) {
                validatedFiles.add(mRelPath);
                const ok = await this.validateSingleFile(rootDir, mRelPath, componentType, issues, componentNames);
                if (ok) passCount++;
              }
            } catch {
              /* no recognizable format, skip */
            }
          }
        }
      }
    }

    return passCount;
  }

  // -------------------------------------------------------------------------
  // Single file validation
  // -------------------------------------------------------------------------

  private async validateSingleFile(
    rootDir: string,
    relPath: string,
    componentType: ComponentType,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
  ): Promise<boolean> {
    const fullPath = join(rootDir, relPath);

    let raw: string;
    try {
      raw = await readFile(fullPath, "utf-8");
    } catch {
      issues.push({
        severity: "error",
        path: relPath,
        message: "Cannot read file",
        code: "FILE_UNREADABLE",
      });
      return false;
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      issues.push({
        severity: "error",
        path: relPath,
        message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        code: "INVALID_JSON",
      });
      return false;
    }

    // Templates use the full AgentTemplateSchema + semantic validation
    if (componentType === "templates") {
      return this.validateTemplateComponent(relPath, data, issues, componentNames);
    }

    const schema = COMPONENT_DIR_SCHEMAS[componentType];
    if (!schema) return true;

    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          severity: "error",
          path: relPath,
          component: (data as { name?: string })?.name,
          message: `${issue.path.join(".")}: ${issue.message}`,
          code: "COMPONENT_SCHEMA",
        });
      }
      return false;
    }

    const parsed = result.data as { name: string; description?: string };
    this.trackComponentName(componentNames, componentType, parsed.name);

    if (!parsed.description) {
      issues.push({
        severity: "warning",
        path: relPath,
        component: parsed.name,
        message: `Missing "description" field`,
        code: "MISSING_DESCRIPTION",
      });
    }

    return true;
  }

  private validateTemplateComponent(
    relPath: string,
    data: unknown,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
  ): boolean {
    const schemaResult = AgentTemplateSchema.safeParse(data);
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        issues.push({
          severity: "error",
          path: relPath,
          component: (data as { name?: string })?.name,
          message: `${issue.path.join(".")}: ${issue.message}`,
          code: "TEMPLATE_SCHEMA",
        });
      }
      return false;
    }

    const semanticResult = validateTemplate(data);
    for (const w of semanticResult.warnings ?? []) {
      issues.push({
        severity: "warning",
        path: relPath,
        component: schemaResult.data.name,
        message: w.message,
        code: w.code ?? "TEMPLATE_SEMANTIC",
      });
    }

    this.trackComponentName(componentNames, "templates", schemaResult.data.name);
    return true;
  }

  // -------------------------------------------------------------------------
  // SKILL.md validation
  // -------------------------------------------------------------------------

  private async validateSkillMd(
    rootDir: string,
    relPath: string,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
    parentDirName?: string,
    compat?: CompatMode,
  ): Promise<boolean> {
    const fullPath = join(rootDir, relPath);

    let raw: string;
    try {
      raw = await readFile(fullPath, "utf-8");
    } catch {
      issues.push({
        severity: "error",
        path: relPath,
        message: "Cannot read SKILL.md file",
        code: "FILE_UNREADABLE",
      });
      return false;
    }

    const skill = parseSkillMdContent(raw);
    if (!skill) {
      issues.push({
        severity: "error",
        path: relPath,
        message: "Invalid SKILL.md: missing YAML frontmatter or required 'name' field",
        code: "SKILL_MD_INVALID",
      });
      return false;
    }

    this.trackComponentName(componentNames, "skills", skill.name);

    if (compat === "agent-skills") {
      this.validateAgentSkillsCompat(skill, relPath, issues, parentDirName, raw);
    } else {
      if (!skill.description) {
        issues.push({
          severity: "warning",
          path: relPath,
          component: skill.name,
          message: `Missing "description" in SKILL.md frontmatter`,
          code: "SKILL_MD_MISSING_DESCRIPTION",
        });
      }
    }

    if (!skill.content || skill.content.trim().length === 0) {
      issues.push({
        severity: "warning",
        path: relPath,
        component: skill.name,
        message: "SKILL.md has empty content body",
        code: "SKILL_MD_EMPTY_CONTENT",
      });
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Agent Skills (agentskills.io) compatibility checks
  // -------------------------------------------------------------------------

  private validateAgentSkillsCompat(
    skill: { name: string; description?: string; compatibility?: string; content: string },
    relPath: string,
    issues: SourceValidationIssue[],
    parentDirName?: string,
    raw?: string,
  ): void {
    const name = skill.name;

    // name: lowercase + hyphens only, 1-64 chars
    const NAME_RE = /^[a-z][a-z0-9-]*$/;
    if (name.length > 64) {
      issues.push({
        severity: "error",
        path: relPath,
        component: name,
        message: `Name exceeds 64 characters (${name.length})`,
        code: "AGENT_SKILLS_NAME_TOO_LONG",
      });
    } else if (!NAME_RE.test(name)) {
      issues.push({
        severity: "error",
        path: relPath,
        component: name,
        message: `Name must contain only lowercase letters, numbers, and hyphens, starting with a letter`,
        code: "AGENT_SKILLS_NAME_FORMAT",
      });
    } else {
      if (name.endsWith("-")) {
        issues.push({
          severity: "error",
          path: relPath,
          component: name,
          message: "Name must not end with a hyphen",
          code: "AGENT_SKILLS_NAME_TRAILING_HYPHEN",
        });
      }
      if (name.includes("--")) {
        issues.push({
          severity: "error",
          path: relPath,
          component: name,
          message: "Name must not contain consecutive hyphens",
          code: "AGENT_SKILLS_NAME_CONSECUTIVE_HYPHENS",
        });
      }
    }

    // name must match parent directory
    if (parentDirName && name !== parentDirName) {
      issues.push({
        severity: "error",
        path: relPath,
        component: name,
        message: `Name "${name}" does not match parent directory "${parentDirName}"`,
        code: "AGENT_SKILLS_NAME_DIR_MISMATCH",
      });
    }

    // description: required, max 1024 chars
    if (!skill.description) {
      issues.push({
        severity: "error",
        path: relPath,
        component: name,
        message: `Missing required "description" field (Agent Skills spec)`,
        code: "AGENT_SKILLS_DESCRIPTION_REQUIRED",
      });
    } else if (skill.description.length > 1024) {
      issues.push({
        severity: "warning",
        path: relPath,
        component: name,
        message: `Description exceeds 1024 characters (${skill.description.length})`,
        code: "AGENT_SKILLS_DESCRIPTION_TOO_LONG",
      });
    }

    // compatibility: max 500 chars if present
    if (skill.compatibility && skill.compatibility.length > 500) {
      issues.push({
        severity: "warning",
        path: relPath,
        component: name,
        message: `Compatibility field exceeds 500 characters (${skill.compatibility.length})`,
        code: "AGENT_SKILLS_COMPAT_TOO_LONG",
      });
    }

    // Body: warn if > 500 lines (progressive disclosure recommendation)
    if (raw) {
      const frontmatterEnd = raw.indexOf("---", 3);
      if (frontmatterEnd !== -1) {
        const body = raw.substring(frontmatterEnd + 3).trim();
        const lineCount = body.split("\n").length;
        if (lineCount > 500) {
          issues.push({
            severity: "warning",
            path: relPath,
            component: name,
            message: `SKILL.md body has ${lineCount} lines; Agent Skills spec recommends < 500 lines`,
            code: "AGENT_SKILLS_BODY_TOO_LONG",
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Agent Skills directory convention (scripts/, references/, assets/)
  // -------------------------------------------------------------------------

  private async validateSkillDirConventions(
    rootDir: string,
    skillDir: string,
    skillName: string,
    issues: SourceValidationIssue[],
  ): Promise<void> {
    const KNOWN_DIRS = new Set(["scripts", "references", "assets"]);
    const KNOWN_FILES = new Set(["SKILL.md", "LICENSE", "LICENSE.txt", "LICENSE.md"]);

    let entries: string[];
    try {
      entries = await readdir(skillDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(skillDir, entry);
      const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
      const entryStat = await stat(fullPath).catch(() => null);
      if (!entryStat) continue;

      if (entryStat.isDirectory()) {
        if (KNOWN_DIRS.has(entry)) {
          issues.push({
            severity: "info",
            path: relPath,
            component: skillName,
            message: `Agent Skills convention: ${entry}/ directory detected`,
            code: "AGENT_SKILLS_DIR_FOUND",
          });
        }
      } else if (!KNOWN_FILES.has(entry)) {
        // Non-standard files are fine; no warning needed
      }
    }
  }

  // -------------------------------------------------------------------------
  // Layer 3: Cross-reference validation
  // -------------------------------------------------------------------------

  private async validatePresetReferences(
    rootDir: string,
    manifest: Record<string, unknown> | null,
    componentNames: Map<string, Set<string>>,
    issues: SourceValidationIssue[],
  ): Promise<void> {
    const presetsDir = join(rootDir, "presets");
    const presetFiles: string[] = [];

    // Collect preset file paths
    if (manifest?.presets) {
      for (const p of manifest.presets as string[]) {
        presetFiles.push(p);
      }
    } else {
      try {
        const entries = await readdir(presetsDir);
        for (const e of entries) {
          if (extname(e) === ".json") {
            presetFiles.push(`presets/${e}`);
          }
        }
      } catch {
        return; // no presets dir
      }
    }

    for (const presetFile of presetFiles) {
      const fullPath = join(rootDir, presetFile);
      let data: Record<string, unknown>;
      try {
        const raw = await readFile(fullPath, "utf-8");
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue; // already reported in component scan
      }

      const presetName = (data.name as string) || presetFile;
      const refMap: Array<[string, ComponentType]> = [
        ["skills", "skills"],
        ["prompts", "prompts"],
        ["mcpServers", "mcp"],
        ["workflows", "workflows"],
        ["templates", "templates"],
      ];

      for (const [field, compType] of refMap) {
        const refs = data[field] as string[] | undefined;
        if (!refs) continue;
        const available = componentNames.get(compType) ?? new Set();
        for (const ref of refs) {
          if (!available.has(ref)) {
            issues.push({
              severity: "warning",
              path: presetFile,
              component: presetName,
              message: `Preset references ${compType} "${ref}" which was not found in this source`,
              code: "PRESET_REF_MISSING",
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Community source validation (no actant.json required)
  // -------------------------------------------------------------------------

  private async validateCommunitySource(
    rootDir: string,
    issues: SourceValidationIssue[],
    compat?: CompatMode,
  ): Promise<number> {
    let passCount = 0;
    const componentNames = new Map<string, Set<string>>();
    passCount += await this.scanCommunityDir(rootDir, rootDir, issues, componentNames, compat);
    if (passCount === 0) {
      issues.push({
        severity: "warning",
        path: ".",
        message: "No SKILL.md files found in community source",
        code: "COMMUNITY_NO_SKILLS",
      });
    }
    return passCount;
  }

  private async scanCommunityDir(
    rootDir: string,
    dirPath: string,
    issues: SourceValidationIssue[],
    componentNames: Map<string, Set<string>>,
    compat?: CompatMode,
  ): Promise<number> {
    let passCount = 0;
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      return 0;
    }

    for (const entry of entries) {
      if (entry === ".git" || entry === "node_modules") continue;
      const fullPath = join(dirPath, entry);
      const entryStat = await stat(fullPath).catch(() => null);
      if (!entryStat?.isDirectory()) continue;

      const skillMdPath = join(fullPath, "SKILL.md");
      try {
        await access(skillMdPath);
        const relPath = relative(rootDir, skillMdPath).replace(/\\/g, "/");
        const ok = await this.validateSkillMd(rootDir, relPath, issues, componentNames, entry, compat);
        if (ok) passCount++;
        if (compat === "agent-skills") {
          await this.validateSkillDirConventions(rootDir, fullPath, entry, issues);
        }
      } catch {
        passCount += await this.scanCommunityDir(rootDir, fullPath, issues, componentNames, compat);
      }
    }
    return passCount;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private trackComponentName(
    componentNames: Map<string, Set<string>>,
    type: string,
    name: string,
  ): void {
    let set = componentNames.get(type);
    if (!set) {
      set = new Set();
      componentNames.set(type, set);
    }
    set.add(name);
  }
}
