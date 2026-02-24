#!/usr/bin/env node
/**
 * Generate issue snapshot for a staged version.
 * Usage: node gen-issue-snapshot.mjs <version> [output-path]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ISSUES_DIR = join(__dirname, "..", "issues");

const version = process.argv[2] || "v0.1.0";
const outputPath = process.argv[3] || join(__dirname, "..", "..", "docs", "stage", version, "issue-snapshot.json");

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
      let v = indented[1].trim();
      if (v === "null") v = null;
      else if (/^-?\d+$/.test(v)) v = Number(v);
      else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      arr.push(v);
      continue;
    }
    if (collecting) { result[currentKey] = arr; collecting = false; arr = []; }
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === "" || val === undefined) { collecting = true; arr = []; }
      else if (val === "[]") { result[currentKey] = []; }
      else if (val === "null") { result[currentKey] = null; }
      else if (/^-?\d+$/.test(val)) { result[currentKey] = Number(val); }
      else if (val.startsWith('"') && val.endsWith('"')) { result[currentKey] = val.slice(1, -1); }
      else { result[currentKey] = val; }
    }
  }
  if (collecting) result[currentKey] = arr;
  return result;
}

async function main() {
  const allFiles = await readdir(ISSUES_DIR);
  const issueFiles = allFiles.filter(f => /^\d{4}-.*\.(json|md)$/.test(f));

  // Deduplicate: prefer .md over .json for same prefix
  const seen = new Map();
  for (const f of issueFiles) {
    const prefix = f.replace(/\.(json|md)$/, "");
    const ext = f.endsWith(".md") ? "md" : "json";
    if (!seen.has(prefix) || ext === "md") {
      seen.set(prefix, f);
    }
  }
  const files = [...seen.values()].sort();

  const snapshot = {
    version,
    date: new Date().toISOString(),
    summary: { open: 0, closed: 0, total: 0 },
    byLabel: {},
    byMilestone: {},
    issues: []
  };

  for (const f of files) {
    let data;
    try {
      const raw = await readFile(join(ISSUES_DIR, f), "utf8");
      if (f.endsWith(".json")) {
        data = JSON.parse(raw);
      } else {
        data = parseFrontmatter(raw);
      }
    } catch {
      console.warn(`  ⚠ Skipping malformed: ${f}`);
      continue;
    }
    snapshot.summary.total++;
    snapshot.summary[data.status] = (snapshot.summary[data.status] || 0) + 1;

    for (const l of (data.labels || [])) {
      snapshot.byLabel[l] = (snapshot.byLabel[l] || 0) + 1;
    }

    if (data.milestone) {
      snapshot.byMilestone[data.milestone] = (snapshot.byMilestone[data.milestone] || 0) + 1;
    }

    // Normalize githubRef — may be string or object
    let ghRef = data.githubRef;
    if (ghRef && typeof ghRef === "object") ghRef = ghRef.url || null;

    snapshot.issues.push({
      id: data.id,
      title: data.title,
      status: data.status,
      labels: data.labels || [],
      milestone: data.milestone || null,
      closedAs: data.closedAs || null,
      githubRef: ghRef || null
    });
  }

  snapshot.issues.sort((a, b) => a.id - b.id);
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`✓ Issue snapshot: ${snapshot.summary.total} issues (${snapshot.summary.open} open, ${snapshot.summary.closed} closed)`);
  console.log(`  Output: ${outputPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
