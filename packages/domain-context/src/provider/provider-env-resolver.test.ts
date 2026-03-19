import { describe, it, expect } from "vitest";
import {
  resolveProviderFromEnv,
  resolveApiKeyFromEnv,
  resolveUpstreamBaseUrl,
  getUpstreamEnvMap,
} from "./provider-env-resolver";

describe("resolveProviderFromEnv", () => {
  it("returns undefined when no provider env vars are set", () => {
    expect(resolveProviderFromEnv({})).toBeUndefined();
  });

  it("reads ACTANT_PROVIDER_TYPE as primary", () => {
    const result = resolveProviderFromEnv({ ACTANT_PROVIDER_TYPE: "anthropic" });
    expect(result).toEqual({ type: "anthropic" });
  });

  it("falls back to ACTANT_PROVIDER when ACTANT_PROVIDER_TYPE is not set", () => {
    const result = resolveProviderFromEnv({ ACTANT_PROVIDER: "openai" });
    expect(result).toEqual({ type: "openai" });
  });

  it("ACTANT_PROVIDER_TYPE takes precedence over ACTANT_PROVIDER", () => {
    const result = resolveProviderFromEnv({
      ACTANT_PROVIDER_TYPE: "anthropic",
      ACTANT_PROVIDER: "openai",
    });
    expect(result?.type).toBe("anthropic");
  });

  it("reads ACTANT_PROVIDER_BASE_URL as primary base URL", () => {
    const result = resolveProviderFromEnv({
      ACTANT_PROVIDER_TYPE: "openai",
      ACTANT_PROVIDER_BASE_URL: "https://custom.api.com",
    });
    expect(result?.baseUrl).toBe("https://custom.api.com");
  });

  it("falls back to ACTANT_BASE_URL for base URL", () => {
    const result = resolveProviderFromEnv({
      ACTANT_PROVIDER_TYPE: "openai",
      ACTANT_BASE_URL: "https://fallback.api.com",
    });
    expect(result?.baseUrl).toBe("https://fallback.api.com");
  });

  it("ACTANT_PROVIDER_BASE_URL takes precedence over ACTANT_BASE_URL", () => {
    const result = resolveProviderFromEnv({
      ACTANT_PROVIDER_TYPE: "openai",
      ACTANT_PROVIDER_BASE_URL: "https://primary.api.com",
      ACTANT_BASE_URL: "https://fallback.api.com",
    });
    expect(result?.baseUrl).toBe("https://primary.api.com");
  });

  it("reads ACTANT_PROVIDER_PROTOCOL when valid", () => {
    const result = resolveProviderFromEnv({
      ACTANT_PROVIDER_TYPE: "custom",
      ACTANT_PROVIDER_PROTOCOL: "openai",
    });
    expect(result?.protocol).toBe("openai");
  });

  it("ignores invalid ACTANT_PROVIDER_PROTOCOL values", () => {
    const result = resolveProviderFromEnv({
      ACTANT_PROVIDER_TYPE: "custom",
      ACTANT_PROVIDER_PROTOCOL: "invalid-protocol",
    });
    expect(result?.protocol).toBeUndefined();
  });

  it("accepts all valid protocol values", () => {
    for (const proto of ["openai", "anthropic", "custom"]) {
      const result = resolveProviderFromEnv({
        ACTANT_PROVIDER_TYPE: "test",
        ACTANT_PROVIDER_PROTOCOL: proto,
      });
      expect(result?.protocol).toBe(proto);
    }
  });

  it("returns minimal config with only type when no other vars set", () => {
    const result = resolveProviderFromEnv({ ACTANT_PROVIDER_TYPE: "deepseek" });
    expect(result).toEqual({ type: "deepseek" });
    expect(result?.baseUrl).toBeUndefined();
    expect(result?.protocol).toBeUndefined();
  });
});

describe("resolveApiKeyFromEnv", () => {
  it("returns undefined when no api key env vars are set", () => {
    expect(resolveApiKeyFromEnv(undefined, {})).toBeUndefined();
  });

  it("reads ACTANT_API_KEY as primary", () => {
    expect(resolveApiKeyFromEnv("anthropic", { ACTANT_API_KEY: "sk-actant" })).toBe("sk-actant");
  });

  it("falls back to ANTHROPIC_API_KEY for anthropic provider", () => {
    expect(resolveApiKeyFromEnv("anthropic", { ANTHROPIC_API_KEY: "sk-ant" })).toBe("sk-ant");
  });

  it("falls back to OPENAI_API_KEY for openai provider", () => {
    expect(resolveApiKeyFromEnv("openai", { OPENAI_API_KEY: "sk-oai" })).toBe("sk-oai");
  });

  it("falls back to OPENAI_API_KEY for deepseek provider", () => {
    expect(resolveApiKeyFromEnv("deepseek", { OPENAI_API_KEY: "sk-ds" })).toBe("sk-ds");
  });

  it("falls back to AZURE_OPENAI_API_KEY for azure provider", () => {
    expect(resolveApiKeyFromEnv("azure", { AZURE_OPENAI_API_KEY: "sk-az" })).toBe("sk-az");
  });

  it("ACTANT_API_KEY takes precedence over upstream vars", () => {
    const result = resolveApiKeyFromEnv("anthropic", {
      ACTANT_API_KEY: "sk-actant",
      ANTHROPIC_API_KEY: "sk-upstream",
    });
    expect(result).toBe("sk-actant");
  });

  it("returns undefined for unknown provider with no ACTANT_API_KEY", () => {
    expect(resolveApiKeyFromEnv("groq", {})).toBeUndefined();
  });

  it("returns undefined when providerType is undefined and no ACTANT_API_KEY", () => {
    expect(resolveApiKeyFromEnv(undefined, {})).toBeUndefined();
  });
});

describe("resolveUpstreamBaseUrl", () => {
  it("reads OPENAI_BASE_URL for openai provider", () => {
    expect(resolveUpstreamBaseUrl("openai", { OPENAI_BASE_URL: "https://oai.example.com" }))
      .toBe("https://oai.example.com");
  });

  it("reads OPENAI_BASE_URL for deepseek provider", () => {
    expect(resolveUpstreamBaseUrl("deepseek", { OPENAI_BASE_URL: "https://ds.example.com" }))
      .toBe("https://ds.example.com");
  });

  it("reads ANTHROPIC_BASE_URL for anthropic provider", () => {
    expect(resolveUpstreamBaseUrl("anthropic", { ANTHROPIC_BASE_URL: "https://ant.example.com" }))
      .toBe("https://ant.example.com");
  });

  it("reads AZURE_OPENAI_ENDPOINT for azure provider", () => {
    expect(resolveUpstreamBaseUrl("azure", { AZURE_OPENAI_ENDPOINT: "https://az.example.com" }))
      .toBe("https://az.example.com");
  });

  it("returns undefined for unknown provider", () => {
    expect(resolveUpstreamBaseUrl("groq", {})).toBeUndefined();
  });

  it("returns undefined when upstream var is not set", () => {
    expect(resolveUpstreamBaseUrl("openai", {})).toBeUndefined();
  });
});

describe("getUpstreamEnvMap", () => {
  it("returns mapping for anthropic", () => {
    expect(getUpstreamEnvMap("anthropic")).toEqual({
      apiKey: "ANTHROPIC_API_KEY",
      baseUrl: "ANTHROPIC_BASE_URL",
    });
  });

  it("returns mapping for openai", () => {
    expect(getUpstreamEnvMap("openai")).toEqual({
      apiKey: "OPENAI_API_KEY",
      baseUrl: "OPENAI_BASE_URL",
    });
  });

  it("returns undefined for unknown provider", () => {
    expect(getUpstreamEnvMap("groq")).toBeUndefined();
  });
});
