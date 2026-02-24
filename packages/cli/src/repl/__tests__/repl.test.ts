import { describe, it, expect } from "vitest";
import { parseArgs } from "../repl";

describe("parseArgs", () => {
  it("parses simple space-separated args", () => {
    expect(parseArgs("agent list")).toEqual(["agent", "list"]);
  });

  it("parses double-quoted argument", () => {
    expect(parseArgs('agent create "my agent"')).toEqual(["agent", "create", "my agent"]);
  });

  it("parses single-quoted argument", () => {
    expect(parseArgs("template show 'my-template'")).toEqual(["template", "show", "my-template"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseArgs("")).toEqual([]);
  });

  it("collapses multiple spaces", () => {
    expect(parseArgs("a   b    c")).toEqual(["a", "b", "c"]);
  });

  it("treats tabs as separators", () => {
    expect(parseArgs("a\tb\tc")).toEqual(["a", "b", "c"]);
  });

  it("parses mixed quotes", () => {
    expect(parseArgs('agent create "hello world" --flag \'test value\'')).toEqual([
      "agent",
      "create",
      "hello world",
      "--flag",
      "test value",
    ]);
  });
});
