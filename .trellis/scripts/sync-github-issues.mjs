#!/usr/bin/env node
/**
 * Sync local .trellis/issues to GitHub Issues (bidirectional-aware, push-primary).
 *
 * Prerequisites: `gh` CLI authenticated (`gh auth login`)
 * Usage: node .trellis/scripts/sync-github-issues.mjs [--dry-run] [--force-update]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";

const REPO = "blackplume233/Actant";
const ISSUES_DIR = join(
  import.meta.dirname,
  "..",
  "issues"
);

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE_UPDATE = process.argv.includes("--force-update");

function gh(args, input) {
  const opts = { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 };
  if (input) opts.input = input;
  return execSync(`gh ${args}`, opts).trim();
}

function ghJson(args, input) {
  const raw = gh(args, input);
  return raw ? JSON.parse(raw) : null;
}

function buildGhBody(issue) {
  let body = issue.body || "";

  const meta = [];
  if (issue.author) meta.push(`**Author:** ${issue.author}`);
  if (issue.milestone) meta.push(`**Milestone:** ${issue.milestone}`);
  if (issue.relatedFiles?.length)
    meta.push(`**Related files:** ${issue.relatedFiles.map((f) => `\`${f}\``).join(", ")}`);
  if (issue.relatedIssues?.length)
    meta.push(`**Related local issues:** ${issue.relatedIssues.map((i) => `#${i}`).join(", ")}`);

  if (meta.length) {
    body += "\n\n---\n_Synced from `.trellis/issues` (local ID: " + issue.id + ")_\n\n" + meta.join("\n");
  } else {
    body += "\n\n---\n_Synced from `.trellis/issues` (local ID: " + issue.id + ")_";
  }

  return body;
}

function sanitizeLabels(labels) {
  if (!labels?.length) return [];
  return labels.map((l) => l.trim()).filter(Boolean);
}

async function ensureLabelsExist(labels) {
  if (!labels.length) return;

  let existing;
  try {
    existing = ghJson(
      `api repos/${REPO}/labels --paginate -q "[.[].name]"`
    );
  } catch {
    existing = [];
  }
  const existingSet = new Set(existing);

  for (const label of labels) {
    if (!existingSet.has(label)) {
      try {
        gh(
          `api repos/${REPO}/labels -X POST -f name="${label}" -f color="ededed"`
        );
        console.log(`  [label] Created label: ${label}`);
        existingSet.add(label);
      } catch (e) {
        console.warn(`  [label] Failed to create label "${label}": ${e.message}`);
      }
    }
  }
}

function parseGhRef(ref) {
  if (!ref) return null;
  const m = ref.match(/#(\d+)$/);
  return m ? Number(m[1]) : null;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const yaml = m[1];
  const result = {};
  let currentKey = null;
  let collecting = false;
  let arr = [];

  for (const line of yaml.split(/\r?\n/)) {
    const indented = line.match(/^  - (.+)/);
    const kv = line.match(/^(\w[\w.]*?):\s*(.*)/);
    if (indented && collecting) {
      arr.push(parseYV(indented[1].trim()));
      continue;
    }
    if (collecting) { result[currentKey] = arr; collecting = false; arr = []; }
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === "" || val === undefined) { collecting = true; arr = []; }
      else if (val === "[]") { result[currentKey] = []; }
      else { result[currentKey] = parseYV(val); }
    }
  }
  if (collecting) result[currentKey] = arr;
  return result;
}

function parseYV(s) {
  if (s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(/,\s*/).map(v => parseYV(v.trim()));
  }
  return s;
}

function parseIssueBody(raw) {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S*)$/);
  const body = m ? m[1].trim() : "";
  // Extract body without comments section
  const commentsIdx = body.indexOf("\n## Comments");
  return commentsIdx >= 0 ? body.slice(0, commentsIdx).trim() : body;
}

function parseComments(raw) {
  const commentsMatch = raw.match(/\n## Comments\s*\n([\s\S]*)$/);
  if (!commentsMatch) return [];
  const comments = [];
  const blocks = commentsMatch[1].split(/\n### /).filter(Boolean);
  for (const block of blocks) {
    const hdr = block.match(/^(.+?)\s*—\s*(.+?)\s*\n([\s\S]*)/);
    if (hdr) comments.push({ author: hdr[1].trim(), date: hdr[2].trim(), text: hdr[3].trim() });
  }
  return comments;
}

async function loadLocalIssues() {
  const files = await readdir(ISSUES_DIR);
  const issues = [];
  for (const f of files) {
    if (f.startsWith(".")) continue;
    const isJson = f.endsWith(".json");
    const isMd = f.endsWith(".md") && /^\d{4}-/.test(f);
    if (!isJson && !isMd) continue;

    const raw = await readFile(join(ISSUES_DIR, f), "utf-8");
    try {
      let data;
      if (isJson) {
        data = JSON.parse(raw);
      } else {
        data = parseFrontmatter(raw);
        data.body = parseIssueBody(raw);
        data.comments = parseComments(raw);
        if (typeof data.githubRef === "string" && data.githubRef !== "null") {
          // keep as string — parseGhRef handles it
        }
      }
      data._file = f;
      data._path = join(ISSUES_DIR, f);
      issues.push(data);
    } catch (e) {
      console.warn(`  [skip] Failed to parse ${f}: ${e.message}`);
    }
  }
  issues.sort((a, b) => (a.id || 0) - (b.id || 0));
  return issues;
}

async function createGhIssue(issue) {
  const labels = sanitizeLabels(issue.labels);
  const body = buildGhBody(issue);

  await ensureLabelsExist(labels);

  const labelArgs = labels.map((l) => `-f "labels[]=${l}"`).join(" ");

  console.log(`  [create] #${issue.id}: ${issue.title}`);
  if (DRY_RUN) {
    console.log(`    (dry-run) Would create GitHub issue`);
    return null;
  }

  const result = ghJson(
    `api repos/${REPO}/issues -X POST -f title="${escapeShell(issue.title)}" -f body=@- ${labelArgs}`,
    body
  );

  const ghNumber = result.number;
  const ghRef = `${REPO}#${ghNumber}`;
  console.log(`    → Created ${ghRef}`);

  if (issue.status === "closed") {
    const closeReason =
      issue.closedAs === "not-planned" ? "not_planned" : "completed";
    gh(
      `api repos/${REPO}/issues/${ghNumber} -X PATCH -f state=closed -f state_reason=${closeReason}`
    );
    console.log(`    → Closed as ${closeReason}`);
  }

  return ghRef;
}

async function updateGhIssue(issue, ghNumber) {
  const labels = sanitizeLabels(issue.labels);
  const body = buildGhBody(issue);

  await ensureLabelsExist(labels);

  console.log(`  [update] #${issue.id} → GitHub #${ghNumber}: ${issue.title}`);
  if (DRY_RUN) {
    console.log(`    (dry-run) Would update GitHub issue #${ghNumber}`);
    return;
  }

  const state = issue.status === "closed" ? "closed" : "open";
  const stateReason =
    issue.status === "closed"
      ? issue.closedAs === "not-planned"
        ? "not_planned"
        : "completed"
      : "reopened";

  gh(
    `api repos/${REPO}/issues/${ghNumber} -X PATCH -f title="${escapeShell(issue.title)}" -f body=@- -f state=${state} -f state_reason=${stateReason}`,
    body
  );

  gh(
    `api repos/${REPO}/issues/${ghNumber}/labels -X PUT --input -`,
    JSON.stringify({ labels })
  );

  console.log(`    → Updated (state: ${state})`);
}

function escapeShell(s) {
  return s.replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`");
}

async function updateLocalFile(issue, ghRef) {
  const raw = await readFile(issue._path, "utf-8");
  const data = JSON.parse(raw);
  data.githubRef = ghRef;
  await writeFile(issue._path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

async function syncComments(issue, ghNumber) {
  if (!issue.comments?.length) return;

  let existing;
  try {
    existing = ghJson(
      `api repos/${REPO}/issues/${ghNumber}/comments --paginate -q "[.[].body]"`
    );
  } catch {
    existing = [];
  }
  const existingBodies = new Set(existing || []);

  for (const c of issue.comments) {
    const commentBody = `**${c.author || "unknown"}** (${c.date || "unknown"}):\n\n${c.text}`;
    const signature = c.text.substring(0, 80);
    const alreadyExists = [...existingBodies].some((b) => b.includes(signature));

    if (alreadyExists) continue;

    console.log(`    [comment] Syncing comment from ${c.author || "unknown"}`);
    if (!DRY_RUN) {
      gh(
        `api repos/${REPO}/issues/${ghNumber}/comments -X POST -f body=@-`,
        commentBody
      );
    }
  }
}

async function main() {
  console.log(`\n🔄 Syncing .trellis/issues → GitHub (${REPO})`);
  if (DRY_RUN) console.log("  ⚠️  DRY RUN mode — no changes will be made\n");
  if (FORCE_UPDATE) console.log("  ⚠️  FORCE UPDATE — all existing issues will be updated\n");

  try {
    gh("auth status");
  } catch {
    console.error("❌ Not authenticated. Run: gh auth login");
    process.exit(1);
  }

  const issues = await loadLocalIssues();
  console.log(`  Found ${issues.length} local issues\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const issue of issues) {
    const ghNumber = parseGhRef(issue.githubRef);

    if (ghNumber) {
      if (FORCE_UPDATE) {
        await updateGhIssue(issue, ghNumber);
        await syncComments(issue, ghNumber);
        updated++;
      } else {
        console.log(`  [skip] #${issue.id} already synced → ${issue.githubRef}`);
        skipped++;
      }
    } else {
      const ghRef = await createGhIssue(issue);
      if (ghRef) {
        await updateLocalFile(issue, ghRef);
        const newGhNumber = parseGhRef(ghRef);
        if (newGhNumber) await syncComments(issue, newGhNumber);
        created++;
      }
    }
  }

  console.log(`\n✅ Done! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
