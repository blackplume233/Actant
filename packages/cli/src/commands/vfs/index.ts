import { Command } from "commander";
import type { RpcClient } from "../../client/rpc-client";
import { presentError, type CliPrinter, defaultPrinter } from "../../output/index";

export function createVfsCommand(client: RpcClient, printer: CliPrinter = defaultPrinter): Command {
  const vfs = new Command("vfs").description("Virtual File System operations");

  // ── L0 Core ──────────────────────────────────────────────────────────

  vfs
    .command("read <path>")
    .description("Read a file from VFS")
    .option("--start <n>", "Start line (1-based, or negative for from end)", parseInt)
    .option("--end <n>", "End line", parseInt)
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { start?: number; end?: number; json?: boolean }) => {
      try {
        const result = await client.call("vfs.read", {
          path,
          startLine: opts.start,
          endLine: opts.end,
        });
        if (opts.json) {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printer.log((result as { content: string }).content);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs
    .command("write <path>")
    .description("Write content to a VFS path")
    .option("--content <text>", "Content to write")
    .option("--file <path>", "Read content from file")
    .action(async (path: string, opts: { content?: string; file?: string }) => {
      try {
        let content = opts.content ?? "";
        if (opts.file) {
          const { readFileSync } = await import("node:fs");
          content = readFileSync(opts.file, "utf-8");
        } else if (!opts.content) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
          content = Buffer.concat(chunks).toString("utf-8");
        }
        const result = await client.call("vfs.write", { path, content });
        const r = result as { bytesWritten: number; created: boolean };
        printer.log(`Written ${r.bytesWritten} bytes (created: ${r.created})`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs
    .command("edit <path>")
    .description("Search-and-replace edit a VFS file")
    .requiredOption("--old <text>", "Text to find")
    .requiredOption("--new <text>", "Replacement text")
    .option("--all", "Replace all occurrences")
    .action(async (path: string, opts: { old: string; new: string; all?: boolean }) => {
      try {
        const result = await client.call("vfs.edit", {
          path,
          oldStr: opts.old,
          newStr: opts.new,
          replaceAll: opts.all,
        });
        const r = result as { replacements: number };
        printer.log(`${r.replacements} replacement(s) made`);
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs
    .command("delete <path>")
    .alias("rm")
    .description("Delete a VFS file")
    .action(async (path: string) => {
      try {
        await client.call("vfs.delete", { path });
        printer.log("Deleted");
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  // ── L1 Navigate ──────────────────────────────────────────────────────

  vfs
    .command("ls [path]")
    .alias("list")
    .description("List files and directories at a VFS path")
    .option("-r, --recursive", "List recursively")
    .option("-l, --long", "Include size and mtime")
    .option("--hidden", "Show hidden files")
    .option("--json", "Output as JSON")
    .action(async (path: string | undefined, opts: { recursive?: boolean; long?: boolean; hidden?: boolean; json?: boolean }) => {
      try {
        const result = await client.call("vfs.list", {
          path: path ?? "/",
          recursive: opts.recursive,
          showHidden: opts.hidden,
          long: opts.long,
        });
        const entries = result as Array<{ name: string; path: string; type: string; size?: number; mtime?: string }>;
        if (opts.json) {
          printer.log(JSON.stringify(entries, null, 2));
        } else {
          for (const e of entries) {
            const suffix = e.type === "directory" ? "/" : "";
            const size = opts.long && e.size != null ? `  ${e.size}B` : "";
            const mtime = opts.long && e.mtime ? `  ${e.mtime}` : "";
            printer.log(`${e.path}${suffix}${size}${mtime}`);
          }
          if (entries.length === 0) printer.dim("(empty)");
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs
    .command("stat <path>")
    .description("Get file metadata")
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { json?: boolean }) => {
      try {
        const result = await client.call("vfs.stat", { path });
        if (opts.json) {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          const r = result as { size: number; mtime: string; type: string };
          printer.log(`Type: ${r.type}`);
          printer.log(`Size: ${r.size}`);
          printer.log(`Modified: ${r.mtime}`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs
    .command("tree [path]")
    .description("Display directory tree")
    .option("--depth <n>", "Max depth", parseInt)
    .option("--pattern <p>", "Filter by name pattern")
    .option("--json", "Output as JSON")
    .action(async (path: string | undefined, opts: { depth?: number; pattern?: string; json?: boolean }) => {
      try {
        const result = await client.call("vfs.tree", { path, depth: opts.depth, pattern: opts.pattern });
        if (opts.json) {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          printTree(result as TreeNode, "", true, printer);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs
    .command("find <pattern>")
    .description("Find files matching a glob pattern")
    .option("--cwd <path>", "Search directory")
    .option("--type <t>", "Filter: file, directory, all")
    .action(async (pattern: string, opts: { cwd?: string; type?: string }) => {
      try {
        const result = await client.call("vfs.glob", {
          pattern,
          cwd: opts.cwd,
          type: opts.type as "file" | "directory" | "all" | undefined,
        });
        const r = result as { matches: string[] };
        for (const m of r.matches) printer.log(m);
        if (r.matches.length === 0) printer.dim("(no matches)");
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  // ── L2 Search ────────────────────────────────────────────────────────

  vfs
    .command("grep <pattern> [path]")
    .description("Search file contents by regex")
    .option("-i, --ignore-case", "Case insensitive")
    .option("-C, --context <n>", "Context lines", parseInt)
    .option("--glob <p>", "Filter files by glob")
    .option("--count", "Show match count only")
    .option("--files", "Show file paths only")
    .option("--max <n>", "Max results", parseInt)
    .action(async (pattern: string, path: string | undefined, opts: {
      ignoreCase?: boolean; context?: number; glob?: string;
      count?: boolean; files?: boolean; max?: number;
    }) => {
      try {
        const result = await client.call("vfs.grep", {
          pattern,
          path,
          caseInsensitive: opts.ignoreCase,
          contextLines: opts.context,
          glob: opts.glob,
          maxResults: opts.max,
        });
        const r = result as { matches: Array<{ path: string; line: number; content: string }>; totalMatches: number; truncated: boolean };

        if (opts.count) {
          printer.log(`${r.totalMatches} match(es)${r.truncated ? " (truncated)" : ""}`);
        } else if (opts.files) {
          const files = [...new Set(r.matches.map((m) => m.path))];
          for (const f of files) printer.log(f);
        } else {
          for (const m of r.matches) {
            printer.log(`${m.path}:${m.line}: ${m.content}`);
          }
          if (r.truncated) printer.dim(`(showing ${r.matches.length} of ${r.totalMatches}+ matches)`);
          if (r.matches.length === 0) printer.dim("(no matches)");
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  // ── Meta operations ──────────────────────────────────────────────────

  vfs
    .command("describe <path>")
    .description("Describe a VFS path: type, capabilities, metadata")
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { json?: boolean }) => {
      try {
        const result = await client.call("vfs.describe", { path });
        if (opts.json) {
          printer.log(JSON.stringify(result, null, 2));
        } else {
          const r = result as {
            path: string; mountPoint: string; sourceName: string;
            sourceType: string; capabilities: string[];
          };
          printer.log(`Path:         ${r.path}`);
          printer.log(`Mount Point:  ${r.mountPoint}`);
          printer.log(`Source:       ${r.sourceName} (${r.sourceType})`);
          printer.log(`Capabilities: ${r.capabilities.join(", ")}`);
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  const mount = new Command("mount").description("Mount point operations");

  mount
    .command("list")
    .alias("ls")
    .description("List all VFS mount points")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const result = await client.call("vfs.mountList", {});
        const r = result as { mounts: Array<{ name: string; mountPoint: string; sourceType: string; capabilities: string[]; fileCount: number }> };
        if (opts.json) {
          printer.log(JSON.stringify(r.mounts, null, 2));
        } else {
          for (const m of r.mounts) {
            const caps = m.capabilities.length <= 4
              ? m.capabilities.join(", ")
              : `${m.capabilities.slice(0, 3).join(", ")}, ... (${m.capabilities.length})`;
            printer.log(`${m.mountPoint.padEnd(30)} ${m.sourceType.padEnd(14)} [${caps}]`);
          }
          if (r.mounts.length === 0) printer.dim("(no mounts)");
        }
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  vfs.addCommand(mount);

  vfs
    .command("unmount <name>")
    .description("Unmount a VFS source by name")
    .action(async (name: string) => {
      try {
        const result = await client.call("vfs.unmount", { name });
        const r = result as { ok: boolean };
        printer.log(r.ok ? "Unmounted" : "Not found");
      } catch (err) {
        presentError(err, printer);
        process.exitCode = 1;
      }
    });

  return vfs;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

function printTree(node: TreeNode, prefix: string, isLast: boolean, printer: CliPrinter): void {
  const connector = isLast ? "└── " : "├── ";
  const suffix = node.type === "directory" ? "/" : "";
  printer.log(`${prefix}${connector}${node.name}${suffix}`);
  if (node.children) {
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    for (let i = 0; i < node.children.length; i++) {
      printTree(node.children[i]!, childPrefix, i === node.children.length - 1, printer);
    }
  }
}
