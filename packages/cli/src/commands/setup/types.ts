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
  type: string;
  protocol: "openai" | "anthropic" | "custom";
  baseUrl: string;
  apiKey?: string;
}

export interface AppConfig {
  provider?: ProviderConfig;
  /** Additional registered providers (templates can reference by type). */
  providers?: ProviderConfig[];
  devSourcePath?: string;
  update?: {
    maxBackups: number;
    preUpdateTestCommand: string;
    autoRestartAgents: boolean;
  };
}
