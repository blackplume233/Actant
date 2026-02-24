import type { ModelApiProtocol, ModelProviderConfig } from "@actant/shared";
import { createLogger } from "@actant/shared";

const logger = createLogger("provider-env-resolver");

/**
 * Well-known upstream environment variable mappings per provider type.
 * Each entry maps a provider type to the native env vars that upstream
 * tools (e.g. Anthropic SDK, OpenAI SDK) expect.
 */
const UPSTREAM_ENV_MAP: Record<string, { apiKey?: string; baseUrl?: string }> = {
  anthropic: { apiKey: "ANTHROPIC_API_KEY", baseUrl: "ANTHROPIC_BASE_URL" },
  openai:    { apiKey: "OPENAI_API_KEY",    baseUrl: "OPENAI_BASE_URL" },
  deepseek:  { apiKey: "OPENAI_API_KEY",    baseUrl: "OPENAI_BASE_URL" },
  azure:     { apiKey: "AZURE_OPENAI_API_KEY", baseUrl: "AZURE_OPENAI_ENDPOINT" },
};

const VALID_PROTOCOLS = new Set<string>(["openai", "anthropic", "custom"]);

/**
 * Read provider configuration from environment variables.
 *
 * Variable precedence (first defined wins):
 *   - `ACTANT_PROVIDER_TYPE` / `ACTANT_PROVIDER` → type
 *   - `ACTANT_PROVIDER_BASE_URL` / `ACTANT_BASE_URL` → baseUrl
 *   - `ACTANT_PROVIDER_PROTOCOL` → protocol
 *
 * Returns `undefined` when no provider type can be determined from env.
 */
export function resolveProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): ModelProviderConfig | undefined {
  const type = env["ACTANT_PROVIDER_TYPE"] ?? env["ACTANT_PROVIDER"];
  if (!type) return undefined;

  const baseUrl = env["ACTANT_PROVIDER_BASE_URL"] ?? env["ACTANT_BASE_URL"];
  const rawProtocol = env["ACTANT_PROVIDER_PROTOCOL"];
  const protocol = rawProtocol && VALID_PROTOCOLS.has(rawProtocol)
    ? (rawProtocol as ModelApiProtocol)
    : undefined;

  if (rawProtocol && !protocol) {
    logger.warn({ rawProtocol }, "Ignoring invalid ACTANT_PROVIDER_PROTOCOL value");
  }

  logger.debug({ type, baseUrl, protocol }, "Provider resolved from environment variables");

  return {
    type,
    ...(protocol ? { protocol } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

/**
 * Resolve API key from environment variables, checking both ACTANT_*
 * and upstream provider-specific variables.
 *
 * Precedence: ACTANT_API_KEY → upstream native variable (per provider type).
 */
export function resolveApiKeyFromEnv(
  providerType?: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const actantKey = env["ACTANT_API_KEY"];
  if (actantKey) return actantKey;

  if (providerType) {
    const upstream = UPSTREAM_ENV_MAP[providerType];
    if (upstream?.apiKey) {
      const key = env[upstream.apiKey];
      if (key) {
        logger.debug({ providerType, envVar: upstream.apiKey }, "API key resolved from upstream env var");
        return key;
      }
    }
  }

  return undefined;
}

/**
 * Resolve base URL from upstream provider-specific environment variables.
 * Only used as fallback when neither template nor ACTANT_* vars provide a base URL.
 */
export function resolveUpstreamBaseUrl(
  providerType: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const upstream = UPSTREAM_ENV_MAP[providerType];
  if (!upstream?.baseUrl) return undefined;
  return env[upstream.baseUrl];
}

/**
 * Get the upstream env var mapping for a given provider type.
 * Used by backend-aware env injection (future #141 integration).
 */
export function getUpstreamEnvMap(providerType: string): { apiKey?: string; baseUrl?: string } | undefined {
  return UPSTREAM_ENV_MAP[providerType];
}
