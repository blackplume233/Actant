export type {
  ActantChannel,
  ActantChannelManager,
  ChannelConnectOptions,
  ChannelPermissionMode,
  ChannelPermissions,
  ChannelPromptResult,
  ChannelCapabilities,
  ChannelHostServices,
  HostToolDefinition,
  ToolExecutionResult,
  McpServerSpec,
  McpTransportConfig,
  McpSetResult,
  McpServerStatus,
  PromptOptions,
  SessionOptions,
  ResumeOptions,
} from "./types";
export { DEFAULT_CHANNEL_CAPABILITIES } from "./types";
export { RoutingChannelManager } from "./routing-channel-manager";
export { RecordingChannelDecorator } from "./recording-channel-decorator";
export { RecordingChannelManager } from "./recording-channel-manager";
export {
  channelEventToStreamChunk,
  legacyChunkToChannelEvent,
  channelEventToRecordEntry,
  createHostServicesEventBridge,
} from "./event-compat";
