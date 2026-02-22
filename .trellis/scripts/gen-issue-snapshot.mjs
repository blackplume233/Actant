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

async function main() {
  const files = (await readdir(ISSUES_DIR)).filter(f => /^\d{4}-.*\.json$/.test(f));

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
      data = JSON.parse(await readFile(join(ISSUES_DIR, f), "utf8"));
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

    snapshot.issues.push({
      id: data.id,
      title: data.title,
      status: data.status,
      labels: data.labels || [],
      milestone: data.milestone || null,
      closedAs: data.closedAs || null,
      githubRef: data.githubRef ? data.githubRef.url : null
    });
  }

  snapshot.issues.sort((a, b) => a.id - b.id);
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`✓ Issue snapshot: ${snapshot.summary.total} issues (${snapshot.summary.open} open, ${snapshot.summary.closed} closed)`);
  console.log(`  Output: ${outputPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
