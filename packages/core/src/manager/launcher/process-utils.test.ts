import { describe, it, expect } from "vitest";
import { isProcessAlive, sendSignal } from "./process-utils";

describe("process-utils", () => {
  describe("isProcessAlive", () => {
    it("should return true for the current process", () => {
      expect(isProcessAlive(process.pid)).toBe(true);
    });

    it("should return false for a non-existent PID", () => {
      expect(isProcessAlive(999999)).toBe(false);
    });
  });

  describe("sendSignal", () => {
    it("should return false for a non-existent PID", () => {
      expect(sendSignal(999999, "SIGTERM")).toBe(false);
    });
  });
});
