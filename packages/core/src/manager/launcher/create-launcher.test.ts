import { describe, it, expect } from "vitest";
import { createLauncher } from "./create-launcher";
import { MockLauncher } from "./mock-launcher";
import { ProcessLauncher } from "./process-launcher";

describe("createLauncher", () => {
  it("should return MockLauncher when mode is mock", () => {
    const launcher = createLauncher({ mode: "mock" });
    expect(launcher).toBeInstanceOf(MockLauncher);
  });

  it("should return ProcessLauncher when mode is real", () => {
    const launcher = createLauncher({ mode: "real" });
    expect(launcher).toBeInstanceOf(ProcessLauncher);
  });

  it("should pass processOptions to ProcessLauncher", () => {
    const launcher = createLauncher({ mode: "real", processOptions: { terminateTimeoutMs: 10000 } });
    expect(launcher).toBeInstanceOf(ProcessLauncher);
  });
});
