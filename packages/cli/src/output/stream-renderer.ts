import chalk from "chalk";
import type { StreamChunk } from "@agentcraft/core";

export interface StreamRendererOptions {
  output?: NodeJS.WritableStream;
  /** Prefix printed before the first chunk of a response. */
  agentLabel?: string;
  /** Show tool use indicators. Default: true */
  showTools?: boolean;
}

/**
 * Renders an async stream of {@link StreamChunk} objects to the terminal
 * in real-time, one chunk at a time.
 *
 * Returns the concatenated text once the stream is exhausted.
 */
export async function renderStream(
  stream: AsyncIterable<StreamChunk>,
  options?: StreamRendererOptions,
): Promise<string> {
  const output = options?.output ?? process.stdout;
  const showTools = options?.showTools ?? true;
  const label = options?.agentLabel ?? "agent";

  let started = false;
  let collectedText = "";

  for await (const chunk of stream) {
    if (!started) {
      output.write(chalk.cyan(`${label}> `));
      started = true;
    }

    switch (chunk.type) {
      case "text":
        output.write(chunk.content);
        collectedText += chunk.content;
        break;

      case "tool_use":
        if (showTools) {
          output.write(chalk.dim(`\n  ${chunk.content}\n`));
        }
        break;

      case "result":
        output.write(chunk.content);
        collectedText += chunk.content;
        break;

      case "error":
        output.write(chalk.red(`\n[Error] ${chunk.content}\n`));
        break;
    }
  }

  if (started) {
    output.write("\n\n");
  }

  return collectedText;
}
