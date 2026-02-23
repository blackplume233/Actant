import type { RpcClient } from "../../client/rpc-client";
import type { CliPrinter } from "../../output/index";

export interface SetupContext {
  printer: CliPrinter;
  client: RpcClient;
  actantHome: string;
  /** true when the daemon was started by the setup wizard and should be managed by it */
  daemonStartedBySetup: boolean;
}

export interface ProviderConfig {
  type: "anthropic" | "openai" | "openai-compatible" | "custom";
  protocol: "http" | "websocket" | "grpc";
  baseUrl: string;
  apiKeyEnv: string;
}

export interface AppConfig {
  provider?: ProviderConfig;
  devSourcePath?: string;
  update?: {
    maxBackups: number;
    preUpdateTestCommand: string;
    autoRestartAgents: boolean;
  };
}
