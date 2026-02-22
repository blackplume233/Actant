import { describe, it, expectTypeOf } from "vitest";
import type {
  AgentTemplate,
  AgentBackendConfig,
  ModelProviderConfig,
  DomainContextConfig,
  McpServerRef,
  InitializerConfig,
} from "@actant/shared";
import type { AgentTemplateOutput } from "./template-schema";

/**
 * Static type alignment checks between Zod inferred types and shared interfaces.
 * These tests ensure the schema output stays compatible with hand-written types.
 */
describe("Schema type alignment with shared types", () => {
  it("AgentTemplateOutput extends AgentTemplate", () => {
    expectTypeOf<AgentTemplateOutput>().toMatchTypeOf<AgentTemplate>();
  });

  it("schema backend matches AgentBackendConfig", () => {
    expectTypeOf<AgentTemplateOutput["backend"]>().toMatchTypeOf<AgentBackendConfig>();
  });

  it("schema provider matches ModelProviderConfig", () => {
    expectTypeOf<AgentTemplateOutput["provider"]>().toMatchTypeOf<ModelProviderConfig>();
  });

  it("schema domainContext matches DomainContextConfig", () => {
    expectTypeOf<AgentTemplateOutput["domainContext"]>().toMatchTypeOf<DomainContextConfig>();
  });

  it("schema mcpServers item matches McpServerRef", () => {
    type SchemaServer = NonNullable<AgentTemplateOutput["domainContext"]["mcpServers"]>[number];
    expectTypeOf<SchemaServer>().toMatchTypeOf<McpServerRef>();
  });

  it("schema initializer matches InitializerConfig when defined", () => {
    type SchemaInit = NonNullable<AgentTemplateOutput["initializer"]>;
    expectTypeOf<SchemaInit>().toMatchTypeOf<InitializerConfig>();
  });
});
