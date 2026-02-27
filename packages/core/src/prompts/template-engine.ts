import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const _thisDir = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the prompts directory.
 * - Source / vitest: template-engine.ts lives in src/prompts/, .md files are siblings.
 * - Bundled (tsup): everything is in dist/index.js, .md files are in dist/prompts/.
 * - Workspace link fallback: walk up to src/prompts/ from dist/.
 */
function resolvePromptsDir(): string {
  if (existsSync(resolve(_thisDir, "tool-instructions.md"))) {
    return _thisDir;
  }
  const bundled = resolve(_thisDir, "prompts");
  if (existsSync(bundled)) {
    return bundled;
  }
  const srcFallback = resolve(_thisDir, "..", "src", "prompts");
  if (existsSync(srcFallback)) {
    return srcFallback;
  }
  return _thisDir;
}

let _promptsDir: string | null = null;

function getPromptsDir(): string {
  if (!_promptsDir) {
    _promptsDir = resolvePromptsDir();
  }
  return _promptsDir;
}

/** Load a prompt template file by name from the prompts directory. */
export function loadTemplate(name: string): string {
  return readFileSync(resolve(getPromptsDir(), name), "utf-8");
}

/**
 * Replace `{{variable}}` placeholders in a template string.
 * Unmatched placeholders are replaced with an empty string.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Reset cached directory (for testing). */
export function _resetPromptsDir(): void {
  _promptsDir = null;
}
