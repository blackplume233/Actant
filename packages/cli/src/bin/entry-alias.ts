import { basename } from "node:path";

export function buildHubAliasArgs(rawArgs: string[]): string[] {
  return rawArgs[0] === "hub" ? rawArgs : ["hub", ...rawArgs];
}

export function isActhubExecutable(executablePath: string): boolean {
  const executable = basename(executablePath).toLowerCase();
  return executable === "acthub" || executable === "acthub.exe";
}

export function resolveSeaInvocation(
  argv: string[],
  executablePath: string,
): { argv: string[]; name?: string } {
  if (!isActhubExecutable(executablePath)) {
    return { argv };
  }

  const rawArgs = argv.slice(2);
  return {
    argv: ["node", "acthub", ...buildHubAliasArgs(rawArgs)],
    name: "acthub",
  };
}
