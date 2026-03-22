import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const taskScript = join(repoRoot, ".trellis/scripts/task.sh");
const createDraftScript = join(repoRoot, ".trellis/scripts/create-changelog-draft.sh");
const draftsDir = join(repoRoot, "docs/agent/changelog-drafts");
const cleanupPaths = new Set<string>();

afterEach(() => {
  for (const target of cleanupPaths) {
    rmSync(target, { force: true, recursive: true });
  }
  cleanupPaths.clear();
});

function createGitRepo(initialBranch: string) {
  const tempDir = mkdtempSync(join(tmpdir(), "actant-git-"));
  cleanupPaths.add(tempDir);

  execFileSync("git", ["init"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  execFileSync("git", ["config", "user.name", "Trellis Governance Test"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  execFileSync("git", ["config", "user.email", "trellis-governance@example.com"], {
    cwd: tempDir,
    encoding: "utf8",
  });

  const currentBranch = execFileSync("git", ["branch", "--show-current"], {
    cwd: tempDir,
    encoding: "utf8",
  }).trim();

  if (currentBranch !== initialBranch) {
    execFileSync("git", ["checkout", "-b", initialBranch], {
      cwd: tempDir,
      encoding: "utf8",
    });
  }

  writeFileSync(join(tempDir, "README.md"), "# temp repo\n");
  execFileSync("git", ["add", "README.md"], {
    cwd: tempDir,
    encoding: "utf8",
  });
  execFileSync("git", ["commit", "-m", "init"], {
    cwd: tempDir,
    encoding: "utf8",
  });

  return tempDir;
}

describe("trellis governance scripts", () => {
  it("rejects task.json files missing required governance fields", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "actant-task-"));
    cleanupPaths.add(tempDir);

    const taskJson = join(tempDir, "task.json");
    const content = JSON.stringify(
      {
        name: "broken-task",
        status: "review",
        dev_type: "backend",
        branch: "codex/broken-task",
      },
      null,
      2,
    );
    writeFileSync(taskJson, `${content}\n`);

    const result = spawnSync("bash", [taskScript, "validate-task", tempDir], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("missing required fields");
    expect(result.stdout + result.stderr).toContain("base_branch");
    expect(result.stdout + result.stderr).toContain("title");
  });

  it("creates a compliant changelog draft template", () => {
    const topic = `governance-test-${Date.now()}`;
    const draftPath = execFileSync(
      "bash",
      [createDraftScript, "--topic", topic, "--title", "Governance Test Draft"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    ).trim();

    cleanupPaths.add(draftPath);

    expect(draftPath.startsWith(draftsDir)).toBe(true);

    const draft = readFileSync(draftPath, "utf8");
    expect(draft).toContain("# Governance Test Draft");
    expect(draft).toContain("## 变更摘要");
    expect(draft).toContain("## 用户可见影响");
    expect(draft).toContain("## 破坏性变更/迁移说明");
    expect(draft).toContain("## 验证结果");
    expect(draft).toContain("## 关联 PR / Commit / Issue");
  });

  it("resolves missing base_branch to the repository default branch", () => {
    const tempDir = createGitRepo("master");

    const taskJson = join(tempDir, "task.json");
    writeFileSync(
      taskJson,
      `${JSON.stringify(
        {
          name: "base-branch-fallback",
          branch: "codex/base-branch-fallback",
        },
        null,
        2,
      )}\n`,
    );

    const branch = execFileSync(
      "bash",
      [
        "-c",
        `source "${join(repoRoot, ".trellis/scripts/common/paths.sh")}" && source "${join(repoRoot, ".trellis/scripts/common/task-utils.sh")}" && resolve_task_base_branch "${taskJson}" "${tempDir}"`,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
      },
    ).trim();

    expect(branch).toBe("master");
  });

  it("refuses to overwrite an existing changelog draft without --force", () => {
    const topic = `governance-duplicate-${Date.now()}`;
    const draftPath = execFileSync(
      "bash",
      [createDraftScript, "--topic", topic, "--title", "Duplicate Draft Test"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    ).trim();

    cleanupPaths.add(draftPath);

    const duplicate = spawnSync(
      "bash",
      [createDraftScript, "--topic", topic, "--title", "Duplicate Draft Test"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    expect(duplicate.status).not.toBe(0);
    expect(duplicate.stdout + duplicate.stderr).toContain("draft already exists");
  });
});
