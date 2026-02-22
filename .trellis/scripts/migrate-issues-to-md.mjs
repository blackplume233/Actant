#!/usr/bin/env node
/**
 * Migrate .trellis/issues/*.json → *.md (Obsidian Markdown format)
 *
 * - Reads each JSON issue file
 * - Converts to Markdown with YAML frontmatter + wikilinks + body + comments
 * - Writes the .md file alongside the .json (or replaces it with --replace)
 *
 * Usage:
 *   node migrate-issues-to-md.mjs [--replace] [--dry-run]
 *
 *   --replace   Delete original .json files after successful conversion
 *   --dry-run   Show what would be done without writing files
 */

import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, basename, dirname } from "node:path";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const ISSUES_DIR = join(SCRIPT_DIR, "..", "issues");

const REPLACE = process.argv.includes("--replace");
const DRY_RUN = process.argv.includes("--dry-run");

const FIELD_ORDER = [
  "id", "title", "status", "labels", "milestone",
  "author", "assignees", "relatedIssues", "relatedFiles",
  "taskRef", "githubRef", "closedAs",
  "createdAt", "updatedAt", "closedAt",
];

function yamlScalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/[:#\[\]{}|>&*!,?'"]/.test(v) || v.includes("\n") || v === "" ||
        v === "null" || v === "true" || v === "false") {
      return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return v;
  }
  return JSON.stringify(v);
}

function serializeYaml(meta) {
  const lines = [];
  for (const key of FIELD_ORDER) {
    if (!(key in meta)) continue;
    const val = meta[key];
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          lines.push(`  - ${yamlScalar(item)}`);
        }
      }
    } else {
      lines.push(`${key}: ${yamlScalar(val)}`);
    }
  }
  return lines.join("\n");
}

function buildWikilinks(relatedIssues, allJsonFiles) {
  if (!relatedIssues?.length) return "";
  return relatedIssues.map(rid => {
    const padded = String(rid).padStart(4, "0");
    const file = allJsonFiles.find(f => basename(f).startsWith(padded + "-"));
    if (file) {
      const name = basename(file, ".json");
      return `[[${name}]]`;
    }
    return `[[${padded}]]`;
  }).join(", ");
}

function normalizeGithubRef(ref) {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && ref.owner && ref.repo && ref.number) {
    return `${ref.owner}/${ref.repo}#${ref.number}`;
  }
  return null;
}

function convertJsonToMarkdown(data, allJsonFiles) {
  const meta = {
    id: data.id,
    title: data.title,
    status: data.status || "open",
    labels: data.labels || [],
    milestone: data.milestone || null,
    author: data.author || "unknown",
    assignees: data.assignees || [],
    relatedIssues: data.relatedIssues || [],
    relatedFiles: data.relatedFiles || [],
    taskRef: data.taskRef || null,
    githubRef: normalizeGithubRef(data.githubRef),
    closedAs: data.closedAs || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    closedAt: data.closedAt || null,
  };

  const yaml = serializeYaml(meta);
  const sections = [];

  // Related links block
  const links = [];
  if (meta.relatedIssues.length) {
    links.push(`**Related Issues**: ${buildWikilinks(meta.relatedIssues, allJsonFiles)}`);
  }
  if (meta.relatedFiles.length) {
    links.push(`**Related Files**: ${meta.relatedFiles.map(f => `\`${f}\``).join(", ")}`);
  }
  if (links.length) sections.push(links.join("\n"));

  // Body
  if (data.body?.trim()) {
    sections.push(data.body.trim());
  }

  // Comments
  if (data.comments?.length) {
    const commentLines = ["## Comments", ""];
    for (const c of data.comments) {
      commentLines.push(`### ${c.author || "unknown"} — ${c.date || "unknown"}`);
      commentLines.push("");
      commentLines.push(c.text || "");
      commentLines.push("");
    }
    sections.push(commentLines.join("\n").trim());
  }

  const body = sections.join("\n\n---\n\n");
  return `---\n${yaml}\n---\n\n${body}\n`;
}

async function main() {
  console.log(`\n📝 Migrating .trellis/issues/ from JSON → Markdown (Obsidian format)`);
  if (DRY_RUN) console.log("  ⚠️  DRY RUN — no files will be written\n");
  if (REPLACE) console.log("  ⚠️  REPLACE mode — .json files will be deleted after conversion\n");

  const entries = await readdir(ISSUES_DIR);
  const jsonFiles = entries
    .filter(f => /^\d{4}-.*\.json$/.test(f))
    .map(f => join(ISSUES_DIR, f))
    .sort();

  console.log(`  Found ${jsonFiles.length} JSON issue files\n`);

  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const jsonPath of jsonFiles) {
    const name = basename(jsonPath, ".json");
    const mdPath = join(ISSUES_DIR, `${name}.md`);

    try {
      const raw = await readFile(jsonPath, "utf-8");
      const data = JSON.parse(raw);

      const md = convertJsonToMarkdown(data, jsonFiles);

      if (DRY_RUN) {
        console.log(`  [convert] ${name}.json → ${name}.md`);
      } else {
        await writeFile(mdPath, md, "utf-8");
        console.log(`  ✓ ${name}.md`);

        if (REPLACE) {
          await unlink(jsonPath);
          console.log(`    ✗ ${name}.json (deleted)`);
        }
      }

      converted++;
    } catch (err) {
      console.error(`  ✗ ${name}.json — ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Done! Converted: ${converted}, Skipped: ${skipped}, Errors: ${errors}`);
  if (!REPLACE && !DRY_RUN) {
    console.log(`\n💡 Run with --replace to delete original .json files`);
  }
}

main().catch(e => { console.error("❌ Fatal:", e.message); process.exit(1); });
