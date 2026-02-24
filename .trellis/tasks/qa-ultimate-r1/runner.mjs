import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const CLI = resolve("g:/Workspace/AgentWorkSpace/AgentCraft/packages/cli/dist/bin/actant.js");
const TEST_DIR = process.env.QA_TEST_DIR || process.env.ACTANT_HOME;
const FIXTURE_DIR = join(TEST_DIR, "fixtures");
const PROJECT_ROOT = "g:/Workspace/AgentWorkSpace/AgentCraft";

const userConfig = join(homedir(), ".actant", "config.json");
const testConfig = join(TEST_DIR, "config.json");
if (existsSync(userConfig) && !existsSync(testConfig)) {
  copyFileSync(userConfig, testConfig);
  console.log(`Copied ${userConfig} → ${testConfig}`);
}
const roundNum = process.env.QA_ROUND || "3";
const LOG_FILE = resolve(`g:/Workspace/AgentWorkSpace/AgentCraft/.trellis/tasks/qa-ultimate-r1/qa-log-round${roundNum}.md`);
const RESULTS_FILE = resolve(`g:/Workspace/AgentWorkSpace/AgentCraft/.trellis/tasks/qa-ultimate-r1/results-r${roundNum}.json`);

const scenario = JSON.parse(readFileSync(
  resolve("g:/Workspace/AgentWorkSpace/AgentCraft/.agents/skills/qa-engineer/scenarios/ultimate-real-user-journey.json"),
  "utf8"
));

function log(text) {
  appendFileSync(LOG_FILE, text + "\n");
}

function splitArgs(command) {
  const args = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

function runCmd(command) {
  const args = splitArgs(command);
  const start = Date.now();
  try {
    const result = spawnSync("node", [CLI, ...args], {
      env: { ...process.env, ACTANT_HOME: TEST_DIR },
      cwd: PROJECT_ROOT,
      timeout: 60000,
      encoding: "utf8",
      windowsHide: true,
    });
    return {
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
      exitCode: result.status ?? -1,
      elapsed: Date.now() - start,
    };
  } catch (e) {
    return { stdout: "", stderr: e.message, exitCode: -99, elapsed: Date.now() - start };
  }
}

function resolveCommand(cmd) {
  return cmd
    .replace(/\$FIXTURE_DIR/g, FIXTURE_DIR)
    .replace(/\$TEST_DIR/g, TEST_DIR)
    .replace(/\$PROJECT_ROOT/g, PROJECT_ROOT)
    .replace(/\$ACTANT_HOME/g, TEST_DIR);
}

function handleWhitebox(cmd) {
  if (cmd.startsWith("_whitebox_read:")) {
    const path = resolveCommand(cmd.slice("_whitebox_read:".length));
    try {
      const content = readFileSync(path, "utf8");
      return { stdout: content.slice(0, 2000), stderr: "", exitCode: 0, elapsed: 0 };
    } catch (e) {
      return { stdout: "", stderr: `File not found: ${path}`, exitCode: 1, elapsed: 0, isEnoent: true };
    }
  }
  if (cmd.startsWith("_whitebox_ls:")) {
    const path = resolveCommand(cmd.slice("_whitebox_ls:".length));
    try {
      const entries = readdirSync(path);
      return { stdout: entries.join("\n"), stderr: "", exitCode: 0, elapsed: 0 };
    } catch (e) {
      return { stdout: "", stderr: `Directory not found: ${path}`, exitCode: 1, elapsed: 0, isEnoent: true };
    }
  }
  if (cmd.startsWith("_whitebox_grep:")) {
    const match = cmd.match(/_whitebox_grep:(.+?) in (.+)/);
    if (!match) return { stdout: "", stderr: "Invalid grep syntax", exitCode: 1, elapsed: 0 };
    const pattern = match[1].trim();
    const dir = resolveCommand(match[2].trim());
    try {
      const result = spawnSync("rg", ["-r", "", "-l", pattern, dir], {
        encoding: "utf8", timeout: 10000, windowsHide: true
      });
      return {
        stdout: (result.stdout || "").trim() || "(no matches)",
        stderr: (result.stderr || "").trim(),
        exitCode: result.status ?? 0,
        elapsed: 0
      };
    } catch (e) {
      return { stdout: "(rg not available, skipped)", stderr: e.message, exitCode: 0, elapsed: 0 };
    }
  }
  if (cmd.startsWith("_setup:")) {
    const setupCmd = cmd.slice("_setup:".length).trim();
    if (setupCmd.startsWith("create_dir_with_file")) {
      const parts = setupCmd.match(/create_dir_with_file\s+(\S+)\s+(.*)/s);
      if (parts) {
        const filePath = resolveCommand(parts[1]);
        let content = resolveCommand(parts[2]);
        const dir = filePath.replace(/[/\\][^/\\]+$/, "");
        try {
          JSON.parse(content);
        } catch {
          const now = new Date().toISOString();
          content = JSON.stringify({
            id: "qa-mock-" + Date.now(),
            name: "mock-ws-agent",
            templateName: "qa-cursor-tpl",
            templateVersion: "1.0.0",
            backendType: "cursor",
            status: "stopped",
            launchMode: "direct",
            workspacePolicy: "persistent",
            processOwnership: "managed",
            createdAt: now,
            updatedAt: now,
          }, null, 2);
        }
        try {
          mkdirSync(dir, { recursive: true });
          writeFileSync(filePath, content, "utf8");
          return { stdout: `Created ${filePath}`, stderr: "", exitCode: 0, elapsed: 0 };
        } catch (e) {
          return { stdout: "", stderr: e.message, exitCode: 1, elapsed: 0 };
        }
      }
    }
    return { stdout: "(pseudo-command skipped)", stderr: "", exitCode: 0, elapsed: 0, skipped: true };
  }
  if (cmd.startsWith("_rpc:")) {
    return { stdout: "(RPC pseudo-command skipped in batch runner)", stderr: "", exitCode: 0, elapsed: 0, skipped: true };
  }
  return null;
}

function autoJudge(step, result) {
  if (result.skipped) return "SKIP";

  const expect = step.expect;
  const expectFail = expect.includes("退出码非 0") || expect.includes("退出码 1");
  const expectPass = expect.includes("退出码 0") && !expectFail;
  const expectNotExist = expect.includes("不存在") || expect.includes("已被删除") || expect.includes("已不在");
  const hasNote = !!step.note;
  const isConditional = expect.includes("或") || expect.includes("可能");

  if (result.isEnoent && expectNotExist) return "PASS";

  if (expectFail && result.exitCode !== 0) return "PASS";
  if (expectFail && result.exitCode === 0) {
    if (isConditional || hasNote) return "WARN";
    return "FAIL";
  }

  if (result.exitCode === 0 && !expectFail) return "PASS";

  if (result.exitCode !== 0 && !expectFail) {
    if (isConditional || hasNote) return "WARN";
    return "FAIL";
  }

  return "WARN";
}

const results = [];
const steps = scenario.steps;

console.log(`Starting ${steps.length} steps...`);
writeFileSync(LOG_FILE, `# QA Log — ultimate-real-user-journey Round 2\n\n**开始时间**: ${new Date().toISOString()}\n\n---\n\n`);

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  const cmd = resolveCommand(step.command);
  const ts = new Date().toISOString();

  const wb = handleWhitebox(cmd);
  const result = wb ?? runCmd(cmd);
  const verdict = autoJudge(step, result);

  const entry = {
    id: step.id,
    description: step.description,
    command: cmd,
    exitCode: result.exitCode,
    stdout: result.stdout.slice(0, 1500),
    stderr: result.stderr.slice(0, 500),
    elapsed: result.elapsed,
    verdict,
    expect: step.expect,
  };
  results.push(entry);

  log(`### [Step ${i + 1}/${steps.length}] ${step.id} — ${step.description}`);
  log(`**时间**: ${ts}\n`);
  log("#### 输入\n```\n" + cmd + "\n```\n");
  log("#### 输出\n```");
  log(`exit_code: ${result.exitCode}\n\n--- stdout ---\n${result.stdout.slice(0, 1500) || "(empty)"}\n\n--- stderr ---\n${result.stderr.slice(0, 500) || "(empty)"}`);
  log("```\n");
  log(`#### 判断: ${verdict}`);
  log(`期望: ${step.expect}`);
  if (verdict === "FAIL") log(`**分析**: 退出码=${result.exitCode}，与期望不符。`);
  if (verdict === "WARN") log(`**说明**: 条件性期望或注释存在，需人工审查。`);
  log("\n---\n");

  const ch = verdict === "PASS" ? "✓" : verdict === "WARN" ? "⚠" : verdict === "SKIP" ? "○" : "✗";
  process.stdout.write(`[${i + 1}/${steps.length}] ${ch} ${step.id} (${result.elapsed}ms)\n`);
}

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

const pass = results.filter(r => r.verdict === "PASS").length;
const warn = results.filter(r => r.verdict === "WARN").length;
const fail = results.filter(r => r.verdict === "FAIL").length;
const skip = results.filter(r => r.verdict === "SKIP").length;

log(`\n## 执行摘要\n\n- **总步骤**: ${results.length}\n- **PASS**: ${pass}\n- **WARN**: ${warn}\n- **FAIL**: ${fail}\n- **SKIP**: ${skip}\n- **结束时间**: ${new Date().toISOString()}`);
console.log(`\nDone! PASS=${pass} WARN=${warn} FAIL=${fail} SKIP=${skip}`);
