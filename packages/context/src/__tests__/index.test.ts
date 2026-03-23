import { describe, expect, it } from "vitest";
import * as context from "../index";

describe("@actant/context root exports", () => {
  const expectedExports = [
    "compileProjectPermissionRules",
    "createActantNamespaceConfigRegistrations",
    "resolveProjectPermissionConfig",
  ] as const;

  it("keeps project-manifest APIs available", () => {
    expect(Object.keys(context).sort()).toEqual([...expectedExports].sort());
    for (const exportName of expectedExports) {
      expect(context[exportName]).toBeTypeOf("function");
    }
  });
});
