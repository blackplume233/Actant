import { describe, it, expect, vi } from "vitest";
import type { ModelProviderConfig } from "@actant/shared";
import { getBackendManager } from "./backend-registry";
import { modelProviderRegistry } from "../../provider/model-provider-registry";

import "./builtin-backends";

describe("buildProviderEnv — backend-specific strategies", () => {
  const mgr = getBackendManager();

  describe("claude-code strategy", () => {
    it("is registered", () => {
      const fn = mgr.getBuildProviderEnv("claude-code");
      expect(fn).toBeDefined();
    });

    it("returns ANTHROPIC_API_KEY from registry", () => {
      const fn = mgr.getBuildProviderEnv("claude-code")!;
      modelProviderRegistry.register({
        type: "anthropic",
        displayName: "Anthropic",
        protocol: "anthropic",
        apiKey: "sk-test-123",
      });
      modelProviderRegistry.setDefault("anthropic");

      const env = fn(undefined);
      expect(env["ANTHROPIC_API_KEY"]).toBe("sk-test-123");
    });

    it("returns ANTHROPIC_BASE_URL when provider has custom baseUrl", () => {
      const fn = mgr.getBuildProviderEnv("claude-code")!;
      const config: ModelProviderConfig = {
        type: "anthropic",
        baseUrl: "https://custom.api.com",
      };
      const env = fn(config);
      expect(env["ANTHROPIC_BASE_URL"]).toBe("https://custom.api.com");
    });

    it("returns empty env when no provider configured and no fallback", () => {
      modelProviderRegistry.register({
        type: "test-only",
        displayName: "Test",
        protocol: "custom",
      });
      modelProviderRegistry.setDefault("test-only");

      const fn = mgr.getBuildProviderEnv("claude-code")!;
      const env = fn({ type: "test-only" });
      expect(env["ANTHROPIC_API_KEY"]).toBeUndefined();
    });
  });

  describe("cursor backend", () => {
    it("has no buildProviderEnv registered (falls back to default)", () => {
      const fn = mgr.getBuildProviderEnv("cursor");
      expect(fn).toBeUndefined();
    });
  });

  describe("BackendManager behavioral extensions", () => {
    it("registerBuildProviderEnv + getBuildProviderEnv round-trip", () => {
      const custom = (_cfg: ModelProviderConfig | undefined) => ({ MY_KEY: "value" });
      mgr.registerBuildProviderEnv("test-backend", custom);
      const fn = mgr.getBuildProviderEnv("test-backend");
      expect(fn).toBe(custom);
      expect(fn!(undefined)).toEqual({ MY_KEY: "value" });
    });

    it("registerBuilder + getBuilder round-trip", () => {
      const mockBuilder = { backendType: "test-backend", scaffold: vi.fn() };
      mgr.registerBuilder("test-backend", mockBuilder);
      expect(mgr.getBuilder("test-backend")).toBe(mockBuilder);
    });

    it("getBuilder returns undefined for unregistered backend", () => {
      expect(mgr.getBuilder("nonexistent")).toBeUndefined();
    });
  });
});
