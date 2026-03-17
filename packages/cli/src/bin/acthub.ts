#!/usr/bin/env node

export {};

if (!process.env["LOG_LEVEL"]) {
  process.env["LOG_LEVEL"] = "silent";
}

const { buildHubAliasArgs } = await import("./entry-alias");
const rawArgs = process.argv.slice(2);
const args = buildHubAliasArgs(rawArgs);

const { run } = await import("../program");
await run(["node", "acthub", ...args], { name: "acthub" });
