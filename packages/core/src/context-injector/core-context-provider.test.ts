import { describe, it, expect } from "vitest";
import { CoreContextProvider } from "./core-context-provider";
import type { AgentInstanceMeta } from "@actant/shared";

const baseMeta = {
  name: "test-agent",
  templateName: "tpl",
  status: "running",
  backendType: "pi",
  archetype: "employee",
  launchMode: "direct",
  workspacePolicy: "persistent",
  createdAt: new Date().toISOString(),
} as AgentInstanceMeta;

describe("CoreContextProvider", () => {
  const provider = new CoreContextProvider();

  it("has name 'core-identity'", () => {
    expect(provider.name).toBe("core-identity");
  });

  // ── getSystemContext ──────────────────────────────────────

  it("returns context containing agent name", () => {
    const ctx = provider.getSystemContext("my-agent", baseMeta);
    expect(ctx).toContain("my-agent");
  });

  it("returns context containing archetype", () => {
    const ctx = provider.getSystemContext("a", baseMeta);
    expect(ctx).toContain("employee");
  });

  it("returns context with archetype description for employee", () => {
    const ctx = provider.getSystemContext("a", baseMeta);
    expect(ctx).toContain("fully-managed employee agent");
  });

  it("returns context with archetype description for service", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, archetype: "service" };
    const ctx = provider.getSystemContext("svc", meta);
    expect(ctx).toContain("long-running service agent");
  });

  it("returns context with archetype description for repo", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, archetype: "repo" };
    const ctx = provider.getSystemContext("repo-agent", meta);
    expect(ctx).toContain("repository-scoped agent");
  });

  it("returns context containing backend type", () => {
    const ctx = provider.getSystemContext("a", baseMeta);
    expect(ctx).toContain("pi");
  });

  it("returns context containing workspace policy", () => {
    const ctx = provider.getSystemContext("a", baseMeta);
    expect(ctx).toContain("persistent");
  });

  it("handles ephemeral workspace policy", () => {
    const meta: AgentInstanceMeta = { ...baseMeta, workspacePolicy: "ephemeral" };
    const ctx = provider.getSystemContext("a", meta);
    expect(ctx).toContain("ephemeral");
  });

  it("includes Actant platform section", () => {
    const ctx = provider.getSystemContext("a", baseMeta);
    expect(ctx).toContain("Actant Platform Capabilities");
    expect(ctx).toContain("Workspace");
    expect(ctx).toContain("Internal Tools");
    expect(ctx).toContain("Daemon Communication");
    expect(ctx).toContain("Session Tokens");
  });

  it("does not provide getMcpServers or getTools", () => {
    expect("getMcpServers" in provider).toBe(false);
    expect("getTools" in provider).toBe(false);
  });

  // ── Integration ───────────────────────────────────────────

  it("works as a registered provider in SessionContextInjector", async () => {
    const { SessionContextInjector } = await import("./session-context-injector");
    const injector = new SessionContextInjector();
    injector.register(provider);

    const ctx = await injector.prepare("int-agent", baseMeta);
    expect(ctx.systemContextAdditions).toHaveLength(1);
    expect(ctx.systemContextAdditions[0]).toContain("int-agent");
    expect(ctx.systemContextAdditions[0]).toContain("Actant");
  });

  it("appears before canvas context when registered first", async () => {
    const { SessionContextInjector } = await import("./session-context-injector");
    const { CanvasContextProvider } = await import("./canvas-context-provider");
    const injector = new SessionContextInjector();
    injector.register(provider);
    injector.register(new CanvasContextProvider());

    const ctx = await injector.prepare("order-agent", baseMeta);
    expect(ctx.systemContextAdditions.length).toBeGreaterThanOrEqual(2);
    expect(ctx.systemContextAdditions[0]).toContain("Actant Agent Identity");
    expect(ctx.systemContextAdditions[1]).toContain("canvas");
  });
});
