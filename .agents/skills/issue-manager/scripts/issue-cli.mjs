#!/usr/bin/env node
/**
 * Issue Management CLI — Markdown/Obsidian format
 *
 * Replaces the JSON-based issue.sh with Obsidian-style Markdown files:
 *   - YAML frontmatter for structured metadata
 *   - Wikilinks ([[NNNN-slug]]) for related issues
 *   - Rich Markdown body + Comments section
 *
 * Usage: node issue-cli.mjs <command> [args]
 * Commands mirror the original issue.sh interface for backward compatibility.
 */

import { readdir, readFile, writeFile, mkdir, access, unlink as unlinkAsync, rename } from "node:fs/promises";
import { readFileSync, writeFileSync, unlinkSync, statSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, basename, dirname } from "node:path";

// ─── Paths ───────────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const REPO_ROOT = findRepoRoot(SCRIPT_DIR);
const ISSUES_DIR = join(REPO_ROOT, ".trellis", "issues");
const ARCHIVE_DIR = join(ISSUES_DIR, "archive");
const COUNTER_FILE = join(ISSUES_DIR, ".counter");
const DIRTY_FILE = join(ISSUES_DIR, ".dirty");
const GH_OWNER = "blackplume233";
const GH_REPO = "Actant";

function findRepoRoot(from) {
  let dir = from;
  while (dir !== dirname(dir)) {
    try {
      if (statSync(join(dir, ".trellis")).isDirectory()) return dir;
    } catch { /* ignore */ }
    dir = dirname(dir);
  }
  return process.cwd();
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue: s => `\x1b[34m${s}\x1b[0m`,
  magenta: s => `\x1b[35m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  gray: s => `\x1b[90m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
};

function colorLabel(l) {
  const map = {
    bug: C.red, feature: C.green, enhancement: C.cyan,
    question: C.magenta, discussion: C.blue, rfc: C.yellow,
    "priority:P0": C.red, "priority:P1": C.yellow,
    "priority:P2": C.cyan, "priority:P3": C.gray,
    duplicate: C.gray, wontfix: C.gray, blocked: C.red,
  };
  return (map[l] || C.gray)(l);
}

// ─── YAML Frontmatter Parser / Serializer ────────────────────────────────────

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { meta: {}, body: raw };

  const yamlStr = m[1];
  const body = raw.slice(m[0].length).replace(/^\r?\n/, "");
  const meta = parseSimpleYaml(yamlStr);
  return { meta, body };
}

function parseSimpleYaml(yaml) {
  const result = {};
  let currentKey = null;
  let collecting = false;
  let arr = [];

  for (const line of yaml.split(/\r?\n/)) {
    const indented = line.match(/^  - (.+)/);
    const kv = line.match(/^(\w[\w.]*?):\s*(.*)/);

    if (indented && collecting) {
      arr.push(parseYamlValue(indented[1].trim()));
      continue;
    }

    if (collecting) {
      result[currentKey] = arr;
      collecting = false;
      arr = [];
    }

    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === "" || val === undefined) {
        collecting = true;
        arr = [];
      } else if (val === "[]") {
        result[currentKey] = [];
      } else {
        result[currentKey] = parseYamlValue(val);
      }
    }
  }

  if (collecting) {
    result[currentKey] = arr;
  }

  return result;
}

function parseYamlValue(s) {
  if (s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d+\.\d+$/.test(s)) return Number(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(/,\s*/).map(v => parseYamlValue(v.trim()));
  }
  return s;
}

function serializeYaml(meta, fieldOrder) {
  const lines = [];
  for (const key of fieldOrder) {
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

function yamlScalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/[:#\[\]{}|>&*!,?'"]/.test(v) || v.includes("\n") || v === "" || v === "null" || v === "true" || v === "false") {
      return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return v;
  }
  return JSON.stringify(v);
}

// ─── Issue Markdown Format ───────────────────────────────────────────────────

const FIELD_ORDER = [
  "id", "title", "status", "labels", "milestone",
  "author", "assignees", "relatedIssues", "relatedFiles",
  "taskRef", "githubRef", "closedAs",
  "createdAt", "updatedAt", "closedAt",
];

function issueFilenameForSlug(id, slug) {
  const padded = String(id).padStart(4, "0");
  return `${padded}-${slug}.md`;
}

function buildWikilinks(relatedIssues, allFiles) {
  if (!relatedIssues?.length) return "";
  const links = relatedIssues.map(rid => {
    const file = allFiles.find(f => {
      const fid = parseInt(basename(f).match(/^(\d+)/)?.[1] || "0", 10);
      return fid === rid;
    });
    if (file) {
      const name = basename(file, ".md");
      return `[[${name}]]`;
    }
    return `[[${String(rid).padStart(4, "0")}]]`;
  });
  return links.join(", ");
}

function serializeIssue(meta, bodyContent, allIssueFiles = []) {
  const yaml = serializeYaml(meta, FIELD_ORDER);

  const sections = [];

  // Wikilinks block
  const links = [];
  if (meta.relatedIssues?.length) {
    const wikilinks = buildWikilinks(meta.relatedIssues, allIssueFiles);
    links.push(`**Related Issues**: ${wikilinks}`);
  }
  if (meta.relatedFiles?.length) {
    links.push(`**Related Files**: ${meta.relatedFiles.map(f => `\`${f}\``).join(", ")}`);
  }

  if (links.length) {
    sections.push(links.join("\n"));
  }

  if (bodyContent?.trim()) {
    sections.push(bodyContent.trim());
  }

  // Comments section
  if (meta._comments?.length) {
    const commentLines = ["## Comments", ""];
    for (const c of meta._comments) {
      commentLines.push(`### ${c.author} — ${c.date}`);
      commentLines.push("");
      commentLines.push(c.text);
      commentLines.push("");
    }
    sections.push(commentLines.join("\n").trim());
  }

  const body = sections.join("\n\n---\n\n");
  return `---\n${yaml}\n---\n\n${body}\n`;
}

function parseIssueFile(raw) {
  const { meta, body } = parseFrontmatter(raw);

  // Extract comments from body (## Comments section)
  const comments = [];
  const commentsMatch = body.match(/(?:^|\n)## Comments\s*\n([\s\S]*)$/);
  let mainBody = body;

  if (commentsMatch) {
    mainBody = body.slice(0, body.indexOf(commentsMatch[0])).trim();
    const commentBlocks = commentsMatch[1].split(/\n### /).filter(Boolean);
    for (const block of commentBlocks) {
      const headerMatch = block.match(/^(.+?)\s*—\s*(.+?)\s*\n([\s\S]*)/);
      if (headerMatch) {
        comments.push({
          author: headerMatch[1].trim(),
          date: headerMatch[2].trim(),
          text: headerMatch[3].trim(),
        });
      }
    }
  }

  // Strip wikilinks block and --- separators from main body
  mainBody = mainBody
    .replace(/^\*\*Related Issues\*\*:.*\n?/m, "")
    .replace(/^\*\*Related Files\*\*:.*\n?/m, "")
    .replace(/^---\s*$/gm, "")
    .trim();

  meta._comments = comments;
  return { meta, body: mainBody };
}

// ─── File I/O ────────────────────────────────────────────────────────────────

async function ensureDir() {
  await mkdir(ISSUES_DIR, { recursive: true });
  try {
    await access(COUNTER_FILE);
  } catch {
    await writeFile(COUNTER_FILE, "0", "utf-8");
  }
}

async function nextId() {
  await ensureDir();
  const counterVal = parseInt(await readFile(COUNTER_FILE, "utf-8"), 10) || 0;

  const files = await listIssueFiles();
  let maxFileId = 0;
  for (const f of files) {
    const m = basename(f).match(/^(\d+)/);
    if (m) maxFileId = Math.max(maxFileId, parseInt(m[1], 10));
  }

  let next = Math.max(counterVal, maxFileId) + 1;

  // Collision check
  const existing = new Set(files.map(f => basename(f).match(/^(\d+)/)?.[1]));
  while (existing.has(String(next).padStart(4, "0"))) next++;

  await writeFile(COUNTER_FILE, String(next), "utf-8");
  return next;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

async function listIssueFiles() {
  try {
    const entries = await readdir(ISSUES_DIR);
    return entries
      .filter(f => /^\d{4}-.*\.md$/.test(f))
      .map(f => join(ISSUES_DIR, f))
      .sort();
  } catch {
    return [];
  }
}

async function findIssueFile(id) {
  const padded = String(id).padStart(4, "0");
  const files = await listIssueFiles();
  const found = files.find(f => basename(f).startsWith(padded + "-"));
  if (found) return found;
  const archived = await listArchivedFiles();
  return archived.find(f => basename(f).startsWith(padded + "-"));
}

async function listArchivedFiles() {
  try {
    const entries = await readdir(ARCHIVE_DIR);
    return entries
      .filter(f => /^\d{4}-.*\.md$/.test(f))
      .map(f => join(ARCHIVE_DIR, f))
      .sort();
  } catch {
    return [];
  }
}

async function archiveIssue(filepath) {
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const filename = basename(filepath);
  const dest = join(ARCHIVE_DIR, filename);
  await rename(filepath, dest);
  return dest;
}

async function unarchiveIssue(filepath) {
  const filename = basename(filepath);
  const dest = join(ISSUES_DIR, filename);
  await rename(filepath, dest);
  return dest;
}

async function readIssue(filepath) {
  const raw = await readFile(filepath, "utf-8");
  return parseIssueFile(raw);
}

async function writeIssue(filepath, meta, body, allFiles) {
  const content = serializeIssue(meta, body, allFiles);
  await writeFile(filepath, content, "utf-8");
}

// ─── Dirty Tracking ──────────────────────────────────────────────────────────

async function loadDirtySet() {
  try {
    const raw = await readFile(DIRTY_FILE, "utf-8");
    return new Set(raw.split("\n").map(s => s.trim()).filter(Boolean).map(Number));
  } catch {
    return new Set();
  }
}

async function saveDirtySet(set) {
  const sorted = [...set].sort((a, b) => a - b);
  await writeFile(DIRTY_FILE, sorted.join("\n") + "\n", "utf-8");
}

async function markDirty(id) {
  const set = await loadDirtySet();
  set.add(id);
  await saveDirtySet(set);
}

async function clearDirty(id) {
  const set = await loadDirtySet();
  set.delete(id);
  if (set.size === 0) {
    try { const { unlink } = await import("node:fs/promises"); await unlink(DIRTY_FILE); } catch {}
  } else {
    await saveDirtySet(set);
  }
}

// ─── GitHub Sync via gh CLI ──────────────────────────────────────────────────

function ghAvailable() {
  try {
    const r = spawnSync("gh", ["--version"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

/**
 * Execute `gh` CLI with an args array via spawnSync (no shell).
 *
 * Non-ASCII text (titles, bodies) MUST be passed via JSON file + `--input`,
 * never as direct CLI arguments — Windows codepage conversions in the
 * PowerShell → bash → node → gh chain corrupt CJK and other multibyte chars.
 */
function ghSpawn(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf-8",
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || "unknown error";
    throw new Error(`gh: ${stderr}`);
  }
  return (result.stdout || "").trim();
}

function extractGhNumber(ref) {
  if (!ref) return null;
  const m = String(ref).match(/#(\d+)/);
  return m ? Number(m[1]) : null;
}

function buildGhBody(meta, body) {
  let ghBody = body || "";
  if (meta.relatedFiles?.length) {
    ghBody += `\n\n---\n**Related Files**: ${meta.relatedFiles.map(f => `\`${f}\``).join(", ")}`;
  }
  if (meta.relatedIssues?.length) {
    ghBody += `\n**Related Issues**: ${meta.relatedIssues.map(i => `#${i}`).join(", ")}`;
  }
  return ghBody;
}

function ghSyncExisting(ghNum, meta, ghBody) {
  const tmpPayload = join(REPO_ROOT, ".trellis", `_gh_sync_${ghNum}.json`);
  const payload = {
    title: meta.title,
    body: ghBody,
    state: meta.status === "closed" ? "closed" : "open",
  };
  if (meta.status === "closed" && meta.closedAs) {
    payload.state_reason = meta.closedAs === "completed" ? "completed" : "not_planned";
  }
  writeFileSync(tmpPayload, JSON.stringify(payload), "utf-8");

  try {
    ghSpawn([
      "api", `repos/${GH_OWNER}/${GH_REPO}/issues/${ghNum}`,
      "--method", "PATCH",
      "--input", tmpPayload,
    ]);
  } finally {
    try { unlinkSync(tmpPayload); } catch {}
  }
}

function ghCreateNew(meta, ghBody) {
  // Ensure labels exist on GitHub (gh api doesn't auto-create labels like gh issue create -l)
  for (const label of (meta.labels || [])) {
    try {
      ghSpawn(["label", "create", label, "--force"]);
    } catch { /* label already exists or creation failed — continue */ }
  }

  const tmpPayload = join(REPO_ROOT, ".trellis", "_gh_create_payload.json");
  const payload = { title: meta.title, body: ghBody };
  if (meta.labels?.length) payload.labels = meta.labels;
  writeFileSync(tmpPayload, JSON.stringify(payload), "utf-8");

  try {
    const result = ghSpawn([
      "api", `repos/${GH_OWNER}/${GH_REPO}/issues`,
      "--method", "POST",
      "--input", tmpPayload,
      "--jq", ".number",
    ]);
    return result ? Number(result) : null;
  } finally {
    try { unlinkSync(tmpPayload); } catch {}
  }
}

async function syncToGitHub(id, { silent = false } = {}) {
  const filepath = await findIssueFile(id);
  if (!filepath) {
    if (!silent) console.error(C.red(`Sync: issue #${id} not found locally`));
    return false;
  }

  const { meta, body } = await readIssue(filepath);
  const ghNum = extractGhNumber(meta.githubRef);
  const ghBody = buildGhBody(meta, body);

  try {
    if (ghNum) {
      ghSyncExisting(ghNum, meta, ghBody);
    } else {
      const newNum = ghCreateNew(meta, ghBody);
      if (newNum) {
        meta.githubRef = `${GH_OWNER}/${GH_REPO}#${newNum}`;
        meta.updatedAt = now();
        const allFiles = await listIssueFiles();
        await writeIssue(filepath, meta, body, allFiles);
      }
    }

    await clearDirty(id);
    if (!silent) console.error(C.green(`  ✓ Synced #${id} → GitHub`));
    return true;
  } catch (e) {
    if (!silent) console.error(C.yellow(`  ⚠ Sync failed for #${id}: ${e.message}`));
    return false;
  }
}

async function pullFromGitHub(ghNum) {
  const json = ghSpawn([
    "issue", "view", String(ghNum),
    "--json", "number,title,state,labels,body,assignees,createdAt,updatedAt,closedAt",
  ]);
  return JSON.parse(json);
}

async function afterMutation(id, { silent = false } = {}) {
  await markDirty(id);

  if (!ghAvailable()) {
    if (!silent) console.error(C.gray(`  (marked dirty — gh CLI not available, sync later: issue sync ${id})`));
    return;
  }

  await syncToGitHub(id, { silent });
}

// ─── Author / Time ───────────────────────────────────────────────────────────

function getAuthor() {
  try {
    const devFile = join(REPO_ROOT, ".trellis", ".developer");
    const content = readFileSync(devFile, "utf-8");
    const m = content.match(/^name=(.+)/m);
    return m ? m[1].trim() : "unknown";
  } catch {
    return "unknown";
  }
}

function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function cmdCreate(args) {
  let title = "";
  const labels = [];
  let body = "";
  let bodyFile = "";
  let milestone = "";
  const relatedFiles = [];
  const relatedIssues = [];
  let explicitId = null;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--id": explicitId = Number(args[++i]); break;
      case "--label": case "-l": labels.push(args[++i]); break;
      case "--body": case "-b": body = args[++i]; break;
      case "--body-file": bodyFile = args[++i]; break;
      case "--milestone": case "-m": milestone = args[++i]; break;
      case "--file": case "-f": relatedFiles.push(args[++i]); break;
      case "--related": case "-r": relatedIssues.push(Number(args[++i])); break;
      case "--bug": labels.push("bug"); break;
      case "--feature": labels.push("feature"); break;
      case "--enhancement": labels.push("enhancement"); break;
      case "--question": labels.push("question"); break;
      case "--discussion": labels.push("discussion"); break;
      case "--rfc": labels.push("rfc"); break;
      case "--chore": labels.push("chore"); break;
      case "--priority": case "-p": labels.push(`priority:${args[++i]}`); break;
      default:
        if (arg.startsWith("-")) {
          console.error(C.red(`Error: Unknown option ${arg}`));
          process.exit(1);
        }
        if (!title) title = arg;
    }
    i++;
  }

  if (!title) {
    console.error(C.red("Error: title is required"));
    console.error(`\nUsage: issue create "<title>" [options]`);
    console.error(`\nType shortcuts:  --bug  --feature  --enhancement  --question  --discussion  --rfc  --chore`);
    console.error(`Priority:        --priority P0|P1|P2|P3`);
    console.error(`Body:            --body "<markdown>" | --body-file <path>`);
    console.error(`Milestone:       --milestone near-term|mid-term|long-term`);
    console.error(`Relations:       --file <path>  --related <issue-id>`);
    console.error(`GitHub-first:    --id <github-issue-number>  (use GitHub issue number)`);
    process.exit(1);
  }

  if (bodyFile) {
    body = await readFile(bodyFile, "utf-8");
  }

  await ensureDir();
  const id = explicitId || await nextId();
  if (explicitId) {
    const counterVal = parseInt(await readFile(COUNTER_FILE, "utf-8"), 10) || 0;
    if (explicitId > counterVal) {
      await writeFile(COUNTER_FILE, String(explicitId), "utf-8");
    }
  }
  const slug = slugify(title);
  const filename = issueFilenameForSlug(id, slug);
  const filepath = join(ISSUES_DIR, filename);
  const author = getAuthor();
  const timestamp = now();
  const allFiles = await listIssueFiles();

  const meta = {
    id,
    title,
    status: "open",
    labels: [...new Set(labels)],
    milestone: milestone || null,
    author,
    assignees: [],
    relatedIssues,
    relatedFiles,
    taskRef: null,
    githubRef: explicitId ? `blackplume233/Actant#${id}` : null,
    closedAs: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: null,
    _comments: [],
  };

  await writeIssue(filepath, meta, body, allFiles);

  console.error(C.green(`Created #${id}: ${title}`));
  if (labels.length) {
    console.error(`  Labels: ${labels.map(colorLabel).join(", ")}`);
  }
  console.log(id);

  await afterMutation(id);
}

async function cmdList(args) {
  let filterLabel = "";
  let filterMilestone = "";
  let filterAssignee = "";
  let showClosed = false;

  let i = 0;
  while (i < args.length) {
    switch (args[i]) {
      case "--label": case "-l": filterLabel = args[++i]; break;
      case "--milestone": case "-m": filterMilestone = args[++i]; break;
      case "--assignee": case "-a": filterAssignee = args[++i]; break;
      case "--closed": case "--all": showClosed = true; break;
      case "--priority": case "-p": filterLabel = `priority:${args[++i]}`; break;
      case "--bug": filterLabel = "bug"; break;
      case "--feature": filterLabel = "feature"; break;
      case "--question": filterLabel = "question"; break;
      case "--discussion": filterLabel = "discussion"; break;
      case "--rfc": filterLabel = "rfc"; break;
    }
    i++;
  }

  const files = await listIssueFiles();
  const items = [];

  for (const f of files) {
    const { meta } = await readIssue(f);

    if (!showClosed && meta.status === "closed") continue;
    if (filterLabel && !meta.labels?.includes(filterLabel)) continue;
    if (filterMilestone && meta.milestone !== filterMilestone) continue;
    if (filterAssignee && !meta.assignees?.includes(filterAssignee)) continue;

    let pweight = 5;
    for (const pw of [0, 1, 2, 3]) {
      if (meta.labels?.includes(`priority:P${pw}`)) { pweight = pw; break; }
    }

    items.push({ ...meta, _file: f, _pweight: pweight });
  }

  items.sort((a, b) => a._pweight - b._pweight || a.id - b.id);

  if (!items.length) {
    console.log("  (no matching issues)");
    return;
  }

  for (const item of items) {
    const icon = item.status === "open"
      ? C.green("○")
      : item.closedAs === "not-planned" ? C.gray("⊘")
      : item.closedAs === "duplicate" ? C.gray("≡")
      : C.magenta("●");

    const ms = item.milestone ? ` ${C.gray(`[${item.milestone}]`)}` : "";
    const cc = item._comments?.length ? ` ${C.gray(`(${item._comments.length})`)}` : "";

    console.log(`  ${icon} ${C.bold(`#${String(item.id).padEnd(4)}`)} ${item.title}${ms}${cc}`);
    if (item.labels?.length) {
      console.log(`         ${item.labels.map(colorLabel).join(", ")}`);
    }
  }

  console.log(`\n  ${items.length} issue(s)`);
}

async function cmdShow(idStr) {
  if (!idStr) { console.error(C.red("Error: issue ID required")); process.exit(1); }

  const filepath = await findIssueFile(Number(idStr));
  if (!filepath) { console.error(C.red(`Error: issue #${idStr} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);

  const statusDisplay = meta.status === "open"
    ? C.green("Open")
    : `${C.magenta("Closed")} (${meta.closedAs})`;

  console.log(`\n  ${C.bold(`#${meta.id}: ${meta.title}`)}`);
  console.log("  ─────────────────────────────────────────");
  console.log(`  Status:     ${statusDisplay}`);
  console.log(`  Labels:     ${meta.labels?.map(colorLabel).join(", ") || "-"}`);
  console.log(`  Milestone:  ${meta.milestone || "-"}`);
  console.log(`  Author:     ${meta.author || "-"}`);
  console.log(`  Assignees:  ${meta.assignees?.join(", ") || "-"}`);
  if (meta.taskRef) console.log(`  Task:       ${meta.taskRef}`);
  if (meta.githubRef) console.log(`  GitHub:     ${C.cyan(meta.githubRef)}`);
  console.log(`  Created:    ${meta.createdAt}`);
  if (meta.updatedAt !== meta.createdAt) console.log(`  Updated:    ${meta.updatedAt}`);
  if (meta.closedAt) console.log(`  Closed:     ${meta.closedAt}`);
  console.log("");

  if (meta.relatedFiles?.length) {
    console.log(`  ${C.cyan("Related Files:")}`);
    for (const f of meta.relatedFiles) console.log(`    - ${f}`);
    console.log("");
  }
  if (meta.relatedIssues?.length) {
    console.log(`  ${C.cyan("Related:")} ${meta.relatedIssues.map(i => `#${i}`).join(", ")}`);
    console.log("");
  }
  if (body) {
    console.log(`  ${C.cyan("───────── Body ─────────")}`);
    console.log(body.split("\n").map(l => `  ${l}`).join("\n"));
    console.log("");
  }
  if (meta._comments?.length) {
    console.log(`  ${C.cyan(`───────── Comments (${meta._comments.length}) ─────────`)}`);
    for (const c of meta._comments) {
      console.log(`  ${c.author} on ${c.date}:`);
      console.log(`  ${c.text}\n`);
    }
  }
}

async function cmdEdit(args) {
  const id = Number(args[0]);
  if (!id) { console.error(C.red("Error: issue ID required")); process.exit(1); }

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();
  let changed = false;
  const timestamp = now();

  let i = 1;
  while (i < args.length) {
    switch (args[i]) {
      case "--title":
        meta.title = args[++i]; console.log(`  Title → ${meta.title}`); changed = true; break;
      case "--body": case "-b":
        await writeIssue(filepath, { ...meta, updatedAt: timestamp }, args[++i], allFiles);
        console.log("  Body updated"); changed = true; break;
      case "--body-file": {
        const content = await readFile(args[++i], "utf-8");
        await writeIssue(filepath, { ...meta, updatedAt: timestamp }, content, allFiles);
        console.log(`  Body updated from ${args[i]}`); changed = true; break;
      }
      case "--milestone": case "-m": {
        const ms = args[++i];
        meta.milestone = (ms === "none" || ms === "") ? null : ms;
        console.log(`  Milestone → ${ms}`); changed = true; break;
      }
      case "--assign": case "-a":
        if (!meta.assignees.includes(args[i + 1])) meta.assignees.push(args[++i]);
        else i++;
        console.log(`  Assignee + ${args[i]}`); changed = true; break;
      case "--unassign":
        meta.assignees = meta.assignees.filter(a => a !== args[++i]);
        console.log(`  Assignee - ${args[i]}`); changed = true; break;
      case "--add-file":
        if (!meta.relatedFiles.includes(args[i + 1])) meta.relatedFiles.push(args[++i]);
        else i++;
        console.log(`  File + ${args[i]}`); changed = true; break;
      case "--add-related": {
        const rid = Number(args[++i]);
        if (!meta.relatedIssues.includes(rid)) meta.relatedIssues.push(rid);
        console.log(`  Related + #${rid}`); changed = true; break;
      }
      default:
        console.error(C.red(`Error: Unknown option ${args[i]}`)); process.exit(1);
    }
    i++;
  }

  if (changed) {
    meta.updatedAt = timestamp;
    await writeIssue(filepath, meta, body, allFiles);
    console.log(C.green(`Updated #${id}: ${meta.title}`));
    await afterMutation(id);
  } else {
    console.error("Usage: issue edit <id> [--title <t>] [--body <md>] [--milestone <m>] ...");
  }
}

async function cmdLabel(args) {
  const id = Number(args[0]);
  if (!id) { console.error(C.red("Error: issue ID required")); process.exit(1); }

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();
  let changed = false;

  let i = 1;
  while (i < args.length) {
    switch (args[i]) {
      case "--add": case "-a":
        if (!meta.labels.includes(args[i + 1])) meta.labels.push(args[++i]);
        else i++;
        console.log(`  + ${colorLabel(args[i])}`); changed = true; break;
      case "--remove": case "-r":
        meta.labels = meta.labels.filter(l => l !== args[++i]);
        console.log(`  - ${args[i]}`); changed = true; break;
      default:
        console.error(C.red(`Error: Unknown option ${args[i]}. Use --add or --remove`)); process.exit(1);
    }
    i++;
  }

  if (changed) {
    meta.updatedAt = now();
    await writeIssue(filepath, meta, body, allFiles);
    console.log(`  Labels: ${meta.labels.map(colorLabel).join(", ")}`);
    await afterMutation(id);
  }
}

async function cmdClose(args) {
  const id = Number(args[0]);
  if (!id) { console.error(C.red("Error: issue ID required")); process.exit(1); }

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();

  let closedAs = "completed";
  let refId = "";
  let reason = "";

  let i = 1;
  while (i < args.length) {
    switch (args[i]) {
      case "--as": closedAs = args[++i]; break;
      case "--ref": refId = args[++i]; break;
      case "--reason": reason = args[++i]; break;
    }
    i++;
  }

  const timestamp = now();
  const author = getAuthor();

  let commentText = `Closed as ${closedAs}`;
  if (reason) commentText += `: ${reason}`;
  if (refId) commentText += ` (ref #${refId})`;

  meta.status = "closed";
  meta.closedAs = closedAs;
  meta.closedAt = timestamp;
  meta.updatedAt = timestamp;
  meta._comments.push({ text: commentText, date: timestamp, author });

  if (closedAs === "duplicate" && refId) {
    const rid = Number(refId);
    if (!meta.relatedIssues.includes(rid)) meta.relatedIssues.push(rid);
  }

  await writeIssue(filepath, meta, body, allFiles);

  const icon = closedAs === "completed" ? C.magenta("●")
    : closedAs === "not-planned" ? C.gray("⊘")
    : C.gray("≡");
  console.log(`${icon} Closed #${id}: ${meta.title} ${C.gray(`(${closedAs})`)}`);

  await afterMutation(id);

  if (!args.includes("--no-archive")) {
    await archiveIssue(filepath);
    console.log(`  ${C.gray("→ archived")}`);
  }
}

async function cmdArchive(args) {
  if (args.includes("--all")) {
    const files = await listIssueFiles();
    let count = 0;
    for (const f of files) {
      const { meta } = await readIssue(f);
      if (meta.status === "closed") {
        await archiveIssue(f);
        count++;
        console.log(`  ${C.gray("●")} Archived #${meta.id}: ${meta.title}`);
      }
    }
    console.log(`\n  ${count} issue(s) archived`);
    return;
  }

  const id = Number(args[0]);
  if (!id) {
    console.error(C.red("Error: issue ID or --all required"));
    console.error("Usage: issue archive <id> | issue archive --all");
    process.exit(1);
  }

  const files = await listIssueFiles();
  const padded = String(id).padStart(4, "0");
  const filepath = files.find(f => basename(f).startsWith(padded + "-"));
  if (!filepath) {
    console.error(C.red(`Error: issue #${id} not found in active issues (may already be archived)`));
    process.exit(1);
  }

  const { meta } = await readIssue(filepath);
  if (meta.status !== "closed") {
    console.error(C.red(`Error: issue #${id} is still open — close it first`));
    process.exit(1);
  }

  await archiveIssue(filepath);
  console.log(`  ${C.gray("●")} Archived #${id}: ${meta.title}`);
}

async function cmdReopen(idStr) {
  if (!idStr) { console.error(C.red("Error: issue ID required")); process.exit(1); }
  const id = Number(idStr);

  let filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const isArchived = filepath.startsWith(ARCHIVE_DIR);
  if (isArchived) {
    filepath = await unarchiveIssue(filepath);
    console.log(`  ${C.gray("← restored from archive")}`);
  }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();
  const timestamp = now();

  meta.status = "open";
  meta.closedAt = null;
  meta.closedAs = null;
  meta.updatedAt = timestamp;
  meta._comments.push({ text: "Reopened", date: timestamp, author: getAuthor() });

  await writeIssue(filepath, meta, body, allFiles);
  console.log(C.green(`○ Reopened #${id}: ${meta.title}`));

  await afterMutation(id);
}

async function cmdComment(idStr, text) {
  if (!idStr || !text) {
    console.error(C.red("Error: issue ID and comment text required"));
    process.exit(1);
  }
  const id = Number(idStr);

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();
  const timestamp = now();

  meta._comments.push({ text, date: timestamp, author: getAuthor() });
  meta.updatedAt = timestamp;

  await writeIssue(filepath, meta, body, allFiles);
  console.log(C.green(`Comment added to #${id} (${meta._comments.length} total)`));

  await afterMutation(id);
}

async function cmdSearch(query) {
  if (!query) { console.error(C.red("Error: search query required")); process.exit(1); }

  const active = await listIssueFiles();
  const archived = await listArchivedFiles();
  const files = [...active, ...archived];
  const queryLower = query.toLowerCase();
  let count = 0;

  for (const f of files) {
    const raw = await readFile(f, "utf-8");
    if (raw.toLowerCase().includes(queryLower)) {
      const { meta } = parseIssueFile(raw);
      const icon = meta.status === "open" ? C.green("○") : C.gray("●");
      console.log(`  ${icon} ${C.bold(`#${String(meta.id).padEnd(4)}`)} ${meta.title}`);
      console.log(`         ${meta.labels?.map(colorLabel).join(", ") || ""}`);
      count++;
    }
  }

  console.log(`\n  ${count} result(s) for "${query}"`);
}

async function cmdStats() {
  const active = await listIssueFiles();
  const archived = await listArchivedFiles();
  const files = [...active, ...archived];
  let total = 0, open = 0, closed = 0;
  let completed = 0, notPlanned = 0, dup = 0;
  const labelCounts = {};

  for (const f of files) {
    const { meta } = await readIssue(f);
    total++;

    if (meta.status === "open") {
      open++;
    } else {
      closed++;
      if (meta.closedAs === "completed") completed++;
      else if (meta.closedAs === "not-planned") notPlanned++;
      else if (meta.closedAs === "duplicate") dup++;
    }

    for (const l of (meta.labels || [])) {
      labelCounts[l] = (labelCounts[l] || 0) + 1;
    }
  }

  console.log(C.bold("Issue Statistics"));
  console.log("────────────────────────────────");
  console.log(`\n  ${C.green("○ Open")}      ${open}  (active)`);
  console.log(`  ${C.magenta("● Closed")}    ${closed}  (${archived.length} archived)`);
  if (closed > 0) {
    console.log(`    completed:   ${completed}`);
    console.log(`    not planned: ${notPlanned}`);
    console.log(`    duplicate:   ${dup}`);
  }
  console.log("  ──────────");
  console.log(`  Total       ${total}\n`);

  if (Object.keys(labelCounts).length) {
    console.log(`  ${C.bold("Labels:")}`);
    const sorted = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]);
    for (const [label, count] of sorted) {
      console.log(`    ${colorLabel(label)}  ${count}`);
    }
    console.log("");
  }
}

async function cmdExport(args) {
  const id = Number(args[0]);
  if (!id) { console.error(C.red("Error: issue ID required")); process.exit(1); }

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);

  let owner = "", repo = "";
  let i = 1;
  while (i < args.length) {
    switch (args[i]) {
      case "--owner": case "-o": owner = args[++i]; break;
      case "--repo": case "-r": repo = args[++i]; break;
    }
    i++;
  }

  let ghBody = body || "";
  if (meta.relatedFiles?.length) {
    ghBody += `\n\n---\n**Related Files**: ${meta.relatedFiles.join(", ")}`;
  }
  if (meta.milestone) ghBody += `\n**Milestone**: ${meta.milestone}`;
  ghBody += `\n\n> Synced from local issue #${meta.id}`;

  const result = {
    title: meta.title,
    body: ghBody,
    labels: meta.labels || [],
    assignees: meta.assignees || [],
  };
  if (owner && repo) { result.owner = owner; result.repo = repo; }

  console.log(JSON.stringify(result, null, 2));
}

async function cmdPromote(args) {
  const id = Number(args[0]);
  if (!id) { console.error(C.red("Error: issue ID required")); process.exit(1); }

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();

  if (meta.taskRef) {
    console.error(C.yellow(`#${id} already promoted → ${meta.taskRef}`));
    process.exit(1);
  }

  let slugOverride = "";
  let i = 1;
  while (i < args.length) {
    if (args[i] === "--slug" || args[i] === "-s") slugOverride = args[++i];
    i++;
  }

  const slug = slugOverride || slugify(meta.title).slice(0, 40);
  let priority = "P2";
  for (const p of ["P0", "P1", "P2", "P3"]) {
    if (meta.labels?.includes(`priority:${p}`)) { priority = p; break; }
  }

  console.error(C.blue(`Promoting #${id} → Task...`));

  let taskPath;
  try {
    const taskScript = join(REPO_ROOT, ".trellis", "scripts", "task.sh");
    const result = spawnSync(taskScript, [
      "create", meta.title, "--slug", slug, "--priority", priority,
    ], { encoding: "utf-8", cwd: REPO_ROOT, stdio: ["pipe", "pipe", "pipe"] });
    if (result.status !== 0) throw new Error(result.stderr || "task create failed");
    taskPath = (result.stdout || "").trim();
  } catch (e) {
    console.error(C.red("Error: failed to create task"));
    process.exit(1);
  }

  const timestamp = now();
  meta.taskRef = taskPath;
  meta.updatedAt = timestamp;
  meta._comments.push({ text: `Promoted to task: ${taskPath}`, date: timestamp, author: getAuthor() });

  await writeIssue(filepath, meta, body, allFiles);

  console.error(C.green(`#${id} → ${taskPath}`));
  console.log(taskPath);
}

async function cmdLink(args) {
  const id = Number(args[0]);
  if (!id) {
    console.error(C.red("Error: issue ID required"));
    console.error("Usage: issue link <id> --github owner/repo#number");
    process.exit(1);
  }

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();

  let owner = "", repo = "", number = "";
  let i = 1;
  while (i < args.length) {
    switch (args[i]) {
      case "--owner": case "-o": owner = args[++i]; break;
      case "--repo": case "-r": repo = args[++i]; break;
      case "--number": case "-n": number = args[++i]; break;
      case "--github": case "-g": {
        const ref = args[++i];
        const m = ref.match(/^(.+?)\/(.+?)#(\d+)$/);
        if (m) { owner = m[1]; repo = m[2]; number = m[3]; }
        break;
      }
    }
    i++;
  }

  if (!owner || !repo || !number) {
    console.error(C.red("Error: --owner, --repo, --number required (or --github owner/repo#number)"));
    process.exit(1);
  }

  meta.githubRef = `${owner}/${repo}#${number}`;
  meta.updatedAt = now();

  await writeIssue(filepath, meta, body, allFiles);
  console.log(C.green(`Linked #${id} → ${C.cyan(`https://github.com/${owner}/${repo}/issues/${number}`)}`));

  await afterMutation(id);
}

async function cmdUnlink(idStr) {
  if (!idStr) { console.error(C.red("Error: issue ID required")); process.exit(1); }
  const id = Number(idStr);

  const filepath = await findIssueFile(id);
  if (!filepath) { console.error(C.red(`Error: issue #${id} not found`)); process.exit(1); }

  const { meta, body } = await readIssue(filepath);
  const allFiles = await listIssueFiles();

  meta.githubRef = null;
  meta.updatedAt = now();

  await writeIssue(filepath, meta, body, allFiles);
  console.log(C.green(`Unlinked #${id} from GitHub`));

  await afterMutation(id);
}

// ─── Sync Commands ───────────────────────────────────────────────────────────

async function cmdSync(args) {
  const syncAll = args.includes("--all") || args.includes("-a");
  const dryRun = args.includes("--dry-run") || args.includes("-n");

  if (syncAll) {
    const dirty = await loadDirtySet();
    if (dirty.size === 0) {
      console.log(C.green("  All issues in sync — nothing to push."));
      return;
    }
    console.log(`  Syncing ${dirty.size} dirty issue(s)...`);
    let ok = 0, fail = 0;
    for (const id of dirty) {
      if (dryRun) {
        console.log(`  [dry-run] would sync #${id}`);
        ok++;
        continue;
      }
      const success = await syncToGitHub(id);
      if (success) ok++; else fail++;
    }
    console.log(`\n  ${C.green(`✓ ${ok} synced`)}${fail ? `, ${C.yellow(`⚠ ${fail} failed`)}` : ""}`);
    return;
  }

  const id = Number(args.find(a => /^\d+$/.test(a)));
  if (!id) {
    console.error(C.red("Error: issue ID or --all required"));
    console.error("Usage: issue sync <id> | issue sync --all");
    process.exit(1);
  }

  if (dryRun) {
    console.log(`  [dry-run] would sync #${id}`);
    return;
  }

  const success = await syncToGitHub(id);
  if (!success) process.exit(1);
}

async function cmdCheckDirty(args) {
  const strict = args.includes("--strict") || args.includes("-s");
  const dirty = await loadDirtySet();

  if (dirty.size === 0) {
    console.log(C.green("  ✓ No dirty issues — all synced with GitHub."));
    process.exit(0);
  }

  console.error(C.yellow(`  ⚠ ${dirty.size} issue(s) have unsynced local changes:`));
  for (const id of dirty) {
    const filepath = await findIssueFile(id);
    const title = filepath ? (await readIssue(filepath)).meta.title : "(file missing)";
    console.error(`    ${C.bold(`#${id}`)} ${title}`);
  }
  console.error("");
  console.error(`  Run ${C.cyan("issue sync --all")} to push changes to GitHub.`);

  if (strict) {
    process.exit(1);
  }
}

async function cmdPull(args) {
  const ghNum = Number(args[0]);
  if (!ghNum) {
    console.error(C.red("Error: GitHub issue number required"));
    console.error("Usage: issue pull <github-number>");
    process.exit(1);
  }

  console.error(C.blue(`  Pulling #${ghNum} from GitHub...`));

  const gh = await pullFromGitHub(ghNum);
  const filepath = await findIssueFile(ghNum);
  const allFiles = await listIssueFiles();

  const ghLabels = (gh.labels || []).map(l => typeof l === "string" ? l : l.name);
  const ghAssignees = (gh.assignees || []).map(a => typeof a === "string" ? a : a.login);

  if (filepath) {
    const { meta, body: existingBody } = await readIssue(filepath);
    meta.title = gh.title;
    meta.status = gh.state === "OPEN" ? "open" : "closed";
    meta.labels = ghLabels;
    meta.assignees = ghAssignees;
    meta.updatedAt = now();
    if (gh.closedAt) meta.closedAt = gh.closedAt;
    await writeIssue(filepath, meta, gh.body || existingBody, allFiles);
    await clearDirty(ghNum);
    console.error(C.green(`  ✓ Updated local #${ghNum} from GitHub`));
  } else {
    await ensureDir();
    const slug = slugify(gh.title);
    const filename = issueFilenameForSlug(ghNum, slug);
    const newpath = join(ISSUES_DIR, filename);
    const author = getAuthor();
    const timestamp = now();

    const meta = {
      id: ghNum,
      title: gh.title,
      status: gh.state === "OPEN" ? "open" : "closed",
      labels: ghLabels,
      milestone: null,
      author,
      assignees: ghAssignees,
      relatedIssues: [],
      relatedFiles: [],
      taskRef: null,
      githubRef: `${GH_OWNER}/${GH_REPO}#${ghNum}`,
      closedAs: gh.state === "OPEN" ? null : "completed",
      createdAt: gh.createdAt || timestamp,
      updatedAt: timestamp,
      closedAt: gh.closedAt || null,
      _comments: [],
    };

    const counterVal = parseInt(await readFile(COUNTER_FILE, "utf-8").catch(() => "0"), 10) || 0;
    if (ghNum > counterVal) {
      await writeFile(COUNTER_FILE, String(ghNum), "utf-8");
    }

    await writeIssue(newpath, meta, gh.body || "", allFiles);
    console.error(C.green(`  ✓ Created local #${ghNum} from GitHub`));
  }
}

async function cmdDirtyList() {
  const dirty = await loadDirtySet();
  if (dirty.size === 0) {
    console.log("[]");
    return;
  }
  console.log(JSON.stringify([...dirty]));
}

// ─── Help ────────────────────────────────────────────────────────────────────

function showUsage() {
  console.log(`Issue Management — GitHub-first, Obsidian Markdown local cache

Usage:
  issue create "<title>" [options]                   Create issue (auto-syncs to GitHub)
  issue list [filters]                               List open issues
  issue show <id>                                    Show details
  issue edit <id> [fields]                           Edit fields (auto-syncs)
  issue label <id> --add <l> | --remove <l>          Manage labels (auto-syncs)
  issue close <id> [--as ...]                        Close issue (auto-syncs, auto-archives)
  issue close <id> --no-archive                      Close without archiving
  issue reopen <id>                                  Reopen issue (auto-restores from archive)
  issue archive <id>                                 Archive a closed issue manually
  issue archive --all                                Archive all closed issues
  issue comment <id> "<text>"                        Add comment (auto-syncs)
  issue promote <id> [--slug <name>]                 Issue → Task
  issue search "<query>"                             Full-text search
  issue stats                                        Statistics
  issue export <id> [--owner <o> --repo <r>]         Export for GitHub
  issue link <id> --github owner/repo#number         Link to GitHub
  issue unlink <id>                                  Remove GitHub link

Sync commands:
  issue sync <id>                                    Push single issue to GitHub
  issue sync --all                                   Push all dirty issues
  issue sync --all --dry-run                         Preview what would sync
  issue check-dirty                                  List unsynced issues (exit 0 if clean)
  issue check-dirty --strict                         Exit 1 if any dirty issues exist
  issue pull <github-number>                         Pull issue from GitHub → local
  issue dirty-list                                   Output dirty IDs as JSON array

Create options:
  --id <github-number>         Use specific GitHub issue number
  --bug --feature --enhancement --question --discussion --rfc --chore
  --priority P0|P1|P2|P3       (adds label priority:Pn)
  --label <name>               (repeatable)
  --body "<markdown>"           Body text
  --body-file <path>           Body from file
  --milestone <name>           near-term | mid-term | long-term
  --file <path>                Related file (repeatable)
  --related <issue-id>         Related issue (repeatable)

List filters:
  --label <name>  --bug  --feature  --question  --discussion  --rfc
  --priority P0|P1|P2|P3   --milestone <name>   --assignee <name>
  --closed                  Include closed issues

Dirty tracking:
  Every mutation (create/edit/label/close/reopen/comment) marks the issue as
  "dirty" and attempts an automatic sync to GitHub via gh CLI. If sync fails
  (no network, auth issue, etc.), the issue stays dirty until manually synced.
  Run "issue check-dirty --strict" before git commit to catch unsynced changes.
`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "create":         await cmdCreate(rest); break;
  case "list": case "ls": await cmdList(rest); break;
  case "archive":        await cmdArchive(rest); break;
  case "show":           await cmdShow(rest[0]); break;
  case "edit":           await cmdEdit(rest); break;
  case "label":          await cmdLabel(rest); break;
  case "close":          await cmdClose(rest); break;
  case "reopen":         await cmdReopen(rest[0]); break;
  case "comment":        await cmdComment(rest[0], rest[1]); break;
  case "promote":        await cmdPromote(rest); break;
  case "search":         await cmdSearch(rest[0]); break;
  case "stats":          await cmdStats(); break;
  case "export":         await cmdExport(rest); break;
  case "link":           await cmdLink(rest); break;
  case "unlink":         await cmdUnlink(rest[0]); break;
  case "sync":           await cmdSync(rest); break;
  case "check-dirty":    await cmdCheckDirty(rest); break;
  case "pull":           await cmdPull(rest); break;
  case "dirty-list":     await cmdDirtyList(); break;
  case "-h": case "--help": case "help": showUsage(); break;
  default:               showUsage(); process.exit(1);
}
