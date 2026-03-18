/**
 * Phase B migration: SessionRegistry stays in `@actant/agent-runtime`
 * (renamed from core). Session lifecycle is an agent-runtime concern.
 */
export {
  SessionRegistry,
  type SessionLease,
  type SessionState,
  type CreateSessionOptions,
  type SessionRegistryOptions,
} from "./session-registry";
