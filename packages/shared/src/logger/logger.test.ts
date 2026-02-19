import { describe, it, expect } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("creates a pino logger with the given module name", () => {
    const logger = createLogger("core:manager");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("logger has child method for sub-loggers", () => {
    const logger = createLogger("core:template");
    const child = logger.child({ instanceId: "abc-123" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
  });
});
