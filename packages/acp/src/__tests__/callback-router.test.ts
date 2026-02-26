import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientCallbackRouter } from "../callback-router";
import type { ClientCallbackHandler } from "../connection";
import type { UpstreamHandler } from "../callback-router";
import type { ClientCapabilities } from "@agentclientprotocol/sdk";

const SID = "test-session-1";

function createMockLocal(): ClientCallbackHandler {
  return {
    requestPermission: vi.fn().mockResolvedValue({ outcome: { optionId: "allow" } }),
    sessionUpdate: vi.fn().mockResolvedValue(undefined),
    readTextFile: vi.fn().mockResolvedValue({ content: "local-content" }),
    writeTextFile: vi.fn().mockResolvedValue({}),
    createTerminal: vi.fn().mockResolvedValue({ terminalId: "local-term-1" }),
    terminalOutput: vi.fn().mockResolvedValue({ output: "local-output", truncated: false }),
    waitForTerminalExit: vi.fn().mockResolvedValue({ exitCode: 0, signal: null }),
    killTerminal: vi.fn().mockResolvedValue({}),
    releaseTerminal: vi.fn().mockResolvedValue({}),
  };
}

function createMockUpstream(): UpstreamHandler {
  return {
    requestPermission: vi.fn().mockResolvedValue({ outcome: { optionId: "ide-allow" } }),
    sessionUpdate: vi.fn().mockResolvedValue(undefined),
    readTextFile: vi.fn().mockResolvedValue({ content: "ide-content" }),
    writeTextFile: vi.fn().mockResolvedValue({}),
    createTerminal: vi.fn().mockResolvedValue({ terminalId: "ide-term-1" }),
    terminalOutput: vi.fn().mockResolvedValue({ output: "ide-output", truncated: false }),
    waitForTerminalExit: vi.fn().mockResolvedValue({ exitCode: 0, signal: null }),
    killTerminal: vi.fn().mockResolvedValue({}),
    releaseTerminal: vi.fn().mockResolvedValue({}),
  };
}

const FULL_CAPS: ClientCapabilities = {
  terminal: true,
  fs: { readTextFile: true, writeTextFile: true },
};

describe("ClientCallbackRouter", () => {
  let local: ReturnType<typeof createMockLocal>;
  let upstream: ReturnType<typeof createMockUpstream>;
  let router: ClientCallbackRouter;

  beforeEach(() => {
    local = createMockLocal();
    upstream = createMockUpstream();
    router = new ClientCallbackRouter(local);
  });

  describe("without upstream (local mode)", () => {
    it("should route createTerminal to local", async () => {
      const result = await router.createTerminal({ command: "bash", args: [], sessionId: SID });
      expect(result.terminalId).toBe("local-term-1");
      expect(local.createTerminal).toHaveBeenCalled();
    });

    it("should route terminalOutput to local", async () => {
      const params = { terminalId: "t1", sessionId: SID };
      const result = await router.terminalOutput(params);
      expect(result.output).toBe("local-output");
      expect(local.terminalOutput).toHaveBeenCalledWith(params);
    });

    it("should route waitForTerminalExit to local", async () => {
      const result = await router.waitForTerminalExit({ terminalId: "t1", sessionId: SID });
      expect(result.exitCode).toBe(0);
      expect(local.waitForTerminalExit).toHaveBeenCalled();
    });

    it("should route killTerminal to local", async () => {
      const params = { terminalId: "t1", sessionId: SID };
      await router.killTerminal(params);
      expect(local.killTerminal).toHaveBeenCalledWith(params);
    });

    it("should route releaseTerminal to local", async () => {
      const params = { terminalId: "t1", sessionId: SID };
      await router.releaseTerminal(params);
      expect(local.releaseTerminal).toHaveBeenCalledWith(params);
    });

    it("should report isLeaseActive as false", () => {
      expect(router.isLeaseActive).toBe(false);
    });
  });

  describe("with upstream (lease mode)", () => {
    beforeEach(() => {
      router.attachUpstream(upstream, FULL_CAPS);
    });

    it("should report isLeaseActive as true", () => {
      expect(router.isLeaseActive).toBe(true);
    });

    it("should forward createTerminal to IDE", async () => {
      const result = await router.createTerminal({ command: "bash", args: [], sessionId: SID });
      expect(result.terminalId).toBe("ide-term-1");
      expect(upstream.createTerminal).toHaveBeenCalled();
      expect(local.createTerminal).not.toHaveBeenCalled();
    });

    it("should forward terminalOutput to IDE", async () => {
      const result = await router.terminalOutput({ terminalId: "t1", sessionId: SID });
      expect(result.output).toBe("ide-output");
      expect(upstream.terminalOutput).toHaveBeenCalled();
      expect(local.terminalOutput).not.toHaveBeenCalled();
    });

    it("should forward waitForTerminalExit to IDE", async () => {
      const result = await router.waitForTerminalExit({ terminalId: "t1", sessionId: SID });
      expect(result.exitCode).toBe(0);
      expect(upstream.waitForTerminalExit).toHaveBeenCalled();
      expect(local.waitForTerminalExit).not.toHaveBeenCalled();
    });

    it("should forward killTerminal to IDE", async () => {
      const params = { terminalId: "t1", sessionId: SID };
      await router.killTerminal(params);
      expect(upstream.killTerminal).toHaveBeenCalledWith(params);
      expect(local.killTerminal).not.toHaveBeenCalled();
    });

    it("should forward releaseTerminal to IDE", async () => {
      const params = { terminalId: "t1", sessionId: SID };
      await router.releaseTerminal(params);
      expect(upstream.releaseTerminal).toHaveBeenCalledWith(params);
      expect(local.releaseTerminal).not.toHaveBeenCalled();
    });

    it("should forward readTextFile to IDE when fs capability declared", async () => {
      const result = await router.readTextFile({ path: "/test.txt", sessionId: SID });
      expect(result.content).toBe("ide-content");
      expect(upstream.readTextFile).toHaveBeenCalled();
    });

    it("should forward writeTextFile to IDE when fs capability declared", async () => {
      await router.writeTextFile({ path: "/test.txt", content: "data", sessionId: SID });
      expect(upstream.writeTextFile).toHaveBeenCalled();
    });
  });

  describe("upstream fallback on error", () => {
    beforeEach(() => {
      router.attachUpstream(upstream, FULL_CAPS);
    });

    it("should fall back to local when IDE createTerminal fails", async () => {
      (upstream.createTerminal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("IDE disconnected"));
      const result = await router.createTerminal({ command: "bash", args: [], sessionId: SID });
      expect(result.terminalId).toBe("local-term-1");
      expect(local.createTerminal).toHaveBeenCalled();
    });

    it("should fall back to local when IDE terminalOutput fails", async () => {
      (upstream.terminalOutput as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("IDE error"));
      const result = await router.terminalOutput({ terminalId: "t1", sessionId: SID });
      expect(result.output).toBe("local-output");
      expect(local.terminalOutput).toHaveBeenCalled();
    });

    it("should fall back to local when IDE waitForTerminalExit fails", async () => {
      (upstream.waitForTerminalExit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("IDE error"));
      const result = await router.waitForTerminalExit({ terminalId: "t1", sessionId: SID });
      expect(result.exitCode).toBe(0);
      expect(local.waitForTerminalExit).toHaveBeenCalled();
    });

    it("should fall back to local when IDE killTerminal fails", async () => {
      (upstream.killTerminal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("IDE error"));
      await router.killTerminal({ terminalId: "t1", sessionId: SID });
      expect(local.killTerminal).toHaveBeenCalled();
    });

    it("should fall back to local when IDE releaseTerminal fails", async () => {
      (upstream.releaseTerminal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("IDE error"));
      await router.releaseTerminal({ terminalId: "t1", sessionId: SID });
      expect(local.releaseTerminal).toHaveBeenCalled();
    });
  });

  describe("capability-based routing", () => {
    it("should use local terminal when IDE declares no terminal capability", async () => {
      router.attachUpstream(upstream, { fs: { readTextFile: true } });
      const result = await router.createTerminal({ command: "bash", args: [], sessionId: SID });
      expect(result.terminalId).toBe("local-term-1");
      expect(upstream.createTerminal).not.toHaveBeenCalled();
    });

    it("should use local fs when IDE declares no fs capability", async () => {
      router.attachUpstream(upstream, { terminal: true });
      const result = await router.readTextFile({ path: "/test.txt", sessionId: SID });
      expect(result.content).toBe("local-content");
      expect(upstream.readTextFile).not.toHaveBeenCalled();
    });
  });

  describe("detach upstream", () => {
    it("should revert to local mode after detach", async () => {
      router.attachUpstream(upstream, FULL_CAPS);
      expect(router.isLeaseActive).toBe(true);

      router.detachUpstream();
      expect(router.isLeaseActive).toBe(false);

      const result = await router.createTerminal({ command: "bash", args: [], sessionId: SID });
      expect(result.terminalId).toBe("local-term-1");
      expect(upstream.createTerminal).not.toHaveBeenCalled();
    });
  });
});
