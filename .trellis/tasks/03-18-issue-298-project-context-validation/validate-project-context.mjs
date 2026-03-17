import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadProjectContext } from "../../../packages/api/dist/services/project-context.js";

async function main() {
  const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
  const targets = [
    {
      name: "repo-root",
      projectDir: repoRoot,
    },
    {
      name: "bootstrap-example",
      projectDir: resolve(repoRoot, "examples", "project-context-bootstrap"),
    },
  ];

  const results = [];
  for (const target of targets) {
    const context = await loadProjectContext(target.projectDir);
    const knowledge = await Promise.all(
      context.summary.entrypoints.knowledge.map(async (filePath) => ({
        path: filePath,
        firstLine: await readFirstNonEmptyLine(filePath),
      })),
    );

    results.push({
      target: target.name,
      projectDir: target.projectDir,
      projectName: context.summary.projectName,
      description: context.summary.description ?? null,
      readFirst: context.summary.entrypoints.readFirst,
      knowledge,
      available: context.summary.available,
      components: context.summary.components,
      sourceWarnings: context.summary.sourceWarnings,
    });
  }

  process.stdout.write(`${JSON.stringify({ validatedAt: new Date().toISOString(), results }, null, 2)}\n`);
}

async function readFirstNonEmptyLine(filePath) {
  const raw = await readFile(filePath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

await main();
