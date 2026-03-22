import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  type VfsFeature,
  type FilesystemTypeDefinition,
  type VfsMountRegistration,
  type VfsLifecycle,
  type VfsHandlerMap,
  type VfsFileContent,
  type VfsEntry,
  type VfsStatusEntry,
  type VfsDiffResult,
  type VfsDiffEntry,
  type VfsFileSchemaMap,
  type VfsGitDiffOptions,
  type VfsListOptions,
} from "@actant/shared";

const execFileAsync = promisify(execFile);

export interface VcsSourceConfig {
  repoPath?: string;
}

const VCS_TRAITS = new Set<VfsFeature>(["persistent", "watchable"]);

const VCS_FILE_SCHEMA: VfsFileSchemaMap = {
  status: { type: "json", capabilities: ["read", "git_status"], dynamic: true },
  diff: { type: "diff", capabilities: ["read", "git_diff"], dynamic: true },
  log: { type: "text", capabilities: ["read"], dynamic: true },
  "HEAD": { type: "text", capabilities: ["read"], dynamic: true },
  branches: { type: "json", capabilities: ["read"], dynamic: true },
};

async function git(repoPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args.join(" ")} failed: ${msg}`, { cause: err });
  }
}

function parseStatusLine(line: string): VfsStatusEntry | null {
  if (line.length < 4) return null;
  return {
    path: line.slice(3).trim(),
    indexStatus: line[0] ?? " ",
    workTreeStatus: line[1] ?? " ",
  };
}

function parseDiffStat(raw: string): VfsDiffResult {
  const entries: VfsDiffEntry[] = [];
  const lines = raw.split("\n");
  const added = 0;
  let modified = 0;
  const deleted = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const pathMatch = line.match(/b\/(.+)$/);
      if (pathMatch) {
        entries.push({ path: pathMatch[1] ?? "", status: "modified" });
        modified++;
      }
    }
  }

  return { entries, summary: { added, modified, deleted } };
}

function createHandlers(repoPath: string): VfsHandlerMap {
  const handlers: VfsHandlerMap = {};

  handlers.read = async (filePath: string): Promise<VfsFileContent> => {
    switch (filePath) {
      case "status": {
        const raw = await git(repoPath, ["status", "--porcelain=v1"]);
        const entries = raw.split("\n").filter(Boolean).map(parseStatusLine).filter(Boolean);
        return { content: JSON.stringify(entries, null, 2), mimeType: "application/json" };
      }
      case "diff": {
        const raw = await git(repoPath, ["diff"]);
        return { content: raw };
      }
      case "log": {
        const raw = await git(repoPath, ["log", "--oneline", "-20"]);
        return { content: raw };
      }
      case "HEAD": {
        const raw = await git(repoPath, ["rev-parse", "HEAD"]);
        return { content: raw.trim() };
      }
      case "branches": {
        const raw = await git(repoPath, ["branch", "-a", "--format=%(refname:short)"]);
        const branches = raw.split("\n").filter(Boolean);
        return { content: JSON.stringify(branches), mimeType: "application/json" };
      }
      default:
        throw new Error(`Unknown VCS file: ${filePath}`);
    }
  };

  handlers.list = async (_dirPath: string, _opts?: VfsListOptions): Promise<VfsEntry[]> => {
    return Object.keys(VCS_FILE_SCHEMA).map((name) => ({
      name,
      path: name,
      type: "file" as const,
    }));
  };

  handlers.git_status = async (): Promise<VfsStatusEntry[]> => {
    const raw = await git(repoPath, ["status", "--porcelain=v1"]);
    return raw.split("\n").filter(Boolean).map(parseStatusLine).filter(Boolean) as VfsStatusEntry[];
  };

  handlers.git_diff = async (opts?: VfsGitDiffOptions): Promise<VfsDiffResult> => {
    const args = ["diff"];
    if (opts?.staged) args.push("--staged");
    if (opts?.commit) args.push(opts.commit);
    if (opts?.path) args.push("--", opts.path);
    const raw = await git(repoPath, args);
    return parseDiffStat(raw);
  };

  return handlers;
}

export const vcsSourceFactory: FilesystemTypeDefinition<VcsSourceConfig> = {
  type: "vcs",
  label: "vcs",
  defaultFeatures: VCS_TRAITS,

  create(spec: VcsSourceConfig, mountPoint: string, lifecycle: VfsLifecycle): VfsMountRegistration {
    const repoPath = spec.repoPath ?? process.cwd();
    const handlers = createHandlers(repoPath);

    return {
      name: "",
      mountPoint,
      label: "vcs",
      features: new Set(VCS_TRAITS),
      lifecycle,
      metadata: {
        description: `VCS: ${repoPath}`,
        readOnly: true,
      },
      fileSchema: VCS_FILE_SCHEMA,
      handlers,
    };
  },
};
