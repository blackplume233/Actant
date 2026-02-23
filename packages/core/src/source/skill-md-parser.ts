import { readFile } from "node:fs/promises";
import type { SkillDefinition } from "@actant/shared";

/**
 * Parses a SKILL.md file (Agent Skills / skill.sh format) into a SkillDefinition.
 * Format:
 * ---
 * name: skill-name
 * description: ...
 * license: MIT
 * metadata:
 *   author: ...
 *   version: "1.0.0"
 *   actant-tags: "tag1,tag2"
 * ---
 *
 * # Skill content starts here...
 */
export async function parseSkillMd(filePath: string): Promise<SkillDefinition | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return parseSkillMdContent(raw);
  } catch {
    return null;
  }
}

/**
 * Parses YAML frontmatter, handling single-line, quoted, and block scalar values.
 * Supports: key: value, key: "quoted", key: | (literal block), key: > (folded block).
 */
function parseYamlFrontmatter(frontmatter: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const lines = frontmatter.split("\n");
  let i = 0;
  let inMetadata = false;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.trim();

    if (trimmed === "metadata:") {
      inMetadata = true;
      i++;
      continue;
    }

    const isNested = inMetadata && (line.startsWith("  ") || line.startsWith("\t"));
    const keyPrefix = isNested ? "metadata." : "";

    const blockMatch = trimmed.match(/^(\w[\w-]*)\s*:\s*(\||>)\s*$/);
    if (blockMatch) {
      const key = keyPrefix + (blockMatch[1] ?? "");
      if (!isNested) inMetadata = false;

      const keyLineIndent = line.search(/\S/);
      const blockIndent = keyLineIndent >= 0 ? keyLineIndent : line.length;
      const blockLines: string[] = [];
      i++;

      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine === undefined) break;
        const nextIndent = nextLine.search(/\S/);
        const isEmpty = nextLine.trim() === "";

        if (isEmpty) {
          blockLines.push(nextLine);
          i++;
          continue;
        }
        if (nextIndent !== -1 && nextIndent <= blockIndent) {
          break;
        }
        blockLines.push(nextLine);
        i++;
      }

      const nonEmpty = blockLines.filter((l) => l.trim() !== "");
      const minIndent =
        nonEmpty.length > 0 ? Math.min(...nonEmpty.map((l) => l.search(/\S/))) : 0;
      meta[key] =
        blockMatch[2] === "|"
          ? blockLines
              .map((l) => (l.trim() === "" ? "" : l.slice(minIndent)))
              .join("\n")
              .trimEnd()
          : blockLines.map((l) => l.trim()).join(" ").trim();
      continue;
    }

    const quotedMatch = trimmed.match(/^(\w[\w-]*)\s*:\s*"((?:[^"\\]|\\.)*)"\s*$/);
    if (quotedMatch) {
      const key = keyPrefix + (quotedMatch[1] ?? "");
      if (!isNested) inMetadata = false;
      try {
        meta[key] = JSON.parse(`"${(quotedMatch[2] ?? "").replace(/\\/g, "\\\\")}"`);
      } catch {
        meta[key] = (quotedMatch[2] ?? "").replace(/\\"/g, '"');
      }
      i++;
      continue;
    }

    const match = trimmed.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (match?.[1] !== undefined) {
      const key = keyPrefix + match[1];
      if (!isNested) inMetadata = false;
      let value = (match[2] ?? "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1).replace(/\\"/g, '"');
        }
      }
      meta[key] = value;
      i++;
      continue;
    }

    if (!isNested) inMetadata = false;
    i++;
  }

  return meta;
}

export function parseSkillMdContent(raw: string): SkillDefinition | null {
  // Check for YAML frontmatter
  if (!raw.startsWith("---")) return null;

  const endIdx = raw.indexOf("---", 3);
  if (endIdx === -1) return null;

  const frontmatter = raw.substring(3, endIdx).trim();
  const content = raw.substring(endIdx + 3).trim();

  // YAML parsing (handles single-line, quoted, and block scalars)
  const meta = parseYamlFrontmatter(frontmatter);

  const name = meta.name;
  if (!name) return null;

  const tags: string[] = [];
  const actantTags = meta["metadata.actant-tags"];
  if (actantTags) {
    tags.push(...actantTags.split(",").map((t) => t.trim()).filter(Boolean));
  }

  return {
    name,
    description: meta.description || undefined,
    version: meta["metadata.version"] || meta.version || undefined,
    content,
    tags: tags.length > 0 ? tags : undefined,
  };
}
