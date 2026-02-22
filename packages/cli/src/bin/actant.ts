#!/usr/bin/env node

export {};

if (!process.env["LOG_LEVEL"]) {
  process.env["LOG_LEVEL"] = "silent";
}

const { run } = await import("../program");
run();
