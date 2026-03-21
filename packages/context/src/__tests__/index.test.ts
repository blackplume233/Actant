import { describe, expect, it } from "vitest";
import * as context from "../index";

describe("@actant/context root exports", () => {
  it("keeps project-manifest APIs available", () => {
    expect(context.createProjectManifestRegistrations).toBeTypeOf("function");
    expect(context.compileProjectPermissionRules).toBeTypeOf("function");
    expect(context.resolveProjectPermissionConfig).toBeTypeOf("function");
  });

  it("does not expose legacy ContextManager or DomainContextSource exports", () => {
    expect("ContextManager" in context).toBe(false);
    expect("DomainContextSource" in context).toBe(false);
  });
});
