import chalk from "chalk";
import type { RpcClient } from "../../../client/rpc-client";
import type { CliPrinter } from "../../../output/index";

export async function helloWorld(
  printer: CliPrinter,
  client: RpcClient,
  createdAgents: string[],
): Promise<void> {
  printer.log(`\n${chalk.cyan("[ Step 6/7 ]")} ${chalk.bold("Hello World 验证")}\n`);

  const alive = await client.ping();
  if (!alive) {
    printer.warn("  ⚠ Daemon 未运行，跳过验证");
    printer.dim("  启动后可手动验证: actant agent run <name> --prompt \"Hello, World!\"");
    return;
  }
  printer.success("  ✓ Daemon 连接正常");

  if (createdAgents.length === 0) {
    printer.dim("  无已创建的 Agent，跳过端到端验证");
    printer.dim("  创建 Agent 后可运行: actant agent run <name> --prompt \"Hello, World!\"");
    return;
  }

  const testAgent = createdAgents[0];
  if (!testAgent) {
    printer.dim("  无可用 Agent，跳过端到端验证");
    return;
  }
  printer.log(chalk.dim(`  正在使用 Agent "${testAgent}" 进行验证...`));

  try {
    await client.call("agent.start", { name: testAgent });
    printer.success(`  ✓ Agent "${testAgent}" 已启动`);

    await waitForAgentReady(client, testAgent, 15000);

    printer.log(chalk.dim(`  发送测试消息: "Hello, World!"`));
    const runResult = await client.call("agent.run", {
      name: testAgent,
      prompt: "Please respond with exactly: Hello from Actant! (keep it short)",
    });

    if (runResult) {
      printer.success("  ✓ 收到 Agent 回复 — 端到端验证通过!");
    } else {
      printer.warn("  ⚠ Agent 未返回结果，但启动正常");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found") || message.includes("NOT_FOUND")) {
      printer.warn(`  ⚠ Agent "${testAgent}" 未找到，跳过验证`);
    } else if (message.includes("Cannot connect")) {
      printer.warn("  ⚠ 无法连接后端 (backend)，请确认后端已安装");
      printer.dim("  提示: claude-code 后端需要安装 claude-agent-acp");
    } else {
      printer.warn(`  ⚠ 验证过程中出现错误: ${message}`);
    }
    printer.dim("  你可以稍后手动验证: actant agent run <name> --prompt \"Hello!\"");
  }
}

async function waitForAgentReady(client: RpcClient, name: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await client.call("agent.status", { name });
      if (status.status === "running") return;
    } catch { /* agent not ready yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
