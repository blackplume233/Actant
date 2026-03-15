#!/usr/bin/env node

/**
 * Black-box TUI test for ClaudeChannelAdapter.
 *
 * Standalone interactive chat that validates the ACP-EX channel protocol
 * end-to-end: TUI input -> ActantChannel -> Claude Agent SDK -> Claude backend.
 *
 * Built on @actant/tui (pi-tui) for proper differential rendering,
 * Markdown output, and VirtualTerminal-based testability.
 *
 * Usage:
 *   pnpm -F @actant/channel-claude test:chat
 *   # or after build:
 *   node dist/bin/test-chat.js [--cwd <dir>] [--model <model>] [--permission <mode>]
 */

import { ProcessTerminal } from "@actant/tui";
import { ActantChatView } from "@actant/tui";
import { ClaudeChannelManagerAdapter } from "../claude-channel-manager.js";

function parseArgs(): { cwd: string; model?: string; permission?: string } {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let model: string | undefined;
  let permission: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--cwd" && args[i + 1]) {
      cwd = args[++i]!;
    } else if (arg === "--model" && args[i + 1]) {
      model = args[++i];
    } else if (arg === "--permission" && args[i + 1]) {
      permission = args[++i];
    }
  }

  return { cwd, model, permission };
}

async function main() {
  const { cwd, model, permission } = parseArgs();

  const manager = new ClaudeChannelManagerAdapter();

  const connectOptions = {
    cwd,
    command: "",
    args: [] as string[],
    adapterOptions: {
      ...(model ? { model } : {}),
      permissionMode: permission ?? "acceptEdits",
    },
  };

  const { sessionId } = await manager.connect("test-chat", connectOptions as never);
  const channel = manager.getChannel("test-chat");
  if (!channel) {
    console.error("Failed to get channel");
    process.exit(1);
  }

  const terminal = new ProcessTerminal();
  const chatView = new ActantChatView(terminal, {
    title: "Actant Channel Protocol (ACP-EX) — Claude SDK",
    subtitle: `cwd: ${cwd}${model ? ` | model: ${model}` : ""} | session: ${sessionId.slice(0, 8)}...\nType your message and press Enter. Press Escape to cancel. Type "/exit" to quit.`,
    cwd,
  });

  chatView.onUserMessage = async (text) => {
    const stream = channel.streamPrompt(sessionId, text);
    await chatView.appendAssistantStream(stream);
  };

  chatView.onCancel = () => {
    channel.cancel(sessionId).catch(() => {});
  };

  chatView.onExit = async () => {
    await manager.disposeAll();
  };

  chatView.start();
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
