import { describe, it, expect, beforeEach } from "vitest";
import { loadTemplate, renderTemplate, _resetPromptsDir } from "./template-engine";

describe("template-engine", () => {
  beforeEach(() => {
    _resetPromptsDir();
  });

  // ── loadTemplate ──────────────────────────────────────────

  it("loads tool-instructions.md", () => {
    const content = loadTemplate("tool-instructions.md");
    expect(content).toContain("Actant Internal Tools");
    expect(content).toContain("{{toolList}}");
    expect(content).toContain("{{token}}");
  });

  it("loads canvas-context.md", () => {
    const content = loadTemplate("canvas-context.md");
    expect(content).toContain("canvas");
    expect(content).toContain("actant_canvas_update");
  });

  it("throws on non-existent template", () => {
    expect(() => loadTemplate("non-existent.md")).toThrow();
  });

  // ── renderTemplate ────────────────────────────────────────

  it("replaces single placeholder", () => {
    const result = renderTemplate("Hello {{name}}!", { name: "world" });
    expect(result).toBe("Hello world!");
  });

  it("replaces multiple placeholders", () => {
    const result = renderTemplate("{{a}} and {{b}}", { a: "X", b: "Y" });
    expect(result).toBe("X and Y");
  });

  it("replaces duplicate placeholders", () => {
    const result = renderTemplate("{{x}} {{x}}", { x: "V" });
    expect(result).toBe("V V");
  });

  it("removes unmatched placeholders", () => {
    const result = renderTemplate("{{known}} {{unknown}}", { known: "ok" });
    expect(result).toBe("ok ");
  });

  it("returns template unchanged when vars is empty", () => {
    const result = renderTemplate("no vars here", {});
    expect(result).toBe("no vars here");
  });

  it("handles empty template string", () => {
    const result = renderTemplate("", { a: "b" });
    expect(result).toBe("");
  });

  it("handles multiline templates", () => {
    const tpl = "line1: {{a}}\nline2: {{b}}\n";
    const result = renderTemplate(tpl, { a: "X", b: "Y" });
    expect(result).toBe("line1: X\nline2: Y\n");
  });

  // ── Integration: load + render ────────────────────────────

  it("loads and renders tool-instructions template", () => {
    const tpl = loadTemplate("tool-instructions.md");
    const result = renderTemplate(tpl, {
      toolList: "  - my_tool: does stuff\n    Usage: actant internal my tool --token tok123",
      token: "tok123",
    });
    expect(result).toContain("my_tool: does stuff");
    expect(result).toContain("tok123");
    expect(result).not.toContain("{{toolList}}");
    expect(result).not.toContain("{{token}}");
  });
});
