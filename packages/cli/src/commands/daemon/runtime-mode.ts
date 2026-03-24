import { isSingleExecutable } from "@actant/shared/core";

export function shouldSpawnEmbeddedDaemon(): boolean {
  return process.env["ACTANT_STANDALONE"] === "1" || isSingleExecutable();
}
