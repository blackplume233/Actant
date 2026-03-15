/**
 * TUI test harness built on pi-tui's VirtualTerminal.
 *
 * Provides a programmatic way to drive a TUI instance in tests:
 * send keyboard input, inspect the rendered viewport, and wait
 * for expected patterns to appear.
 *
 * The VirtualTerminal import is a devDependency-only path — this
 * module should only be imported from test files.
 */

export interface TuiTestHarness {
  /**
   * Send raw string data (as if the user typed it) to the TUI.
   * For special keys use the escape sequences directly or via Key helpers.
   */
  sendInput(data: string): void;

  /**
   * Flush pending terminal writes and return the visible viewport lines.
   */
  getViewport(): Promise<string[]>;

  /**
   * Convenience: flush and return viewport as a single joined string
   * with ANSI escape codes stripped.
   */
  getViewportText(): Promise<string>;

  /**
   * Wait until the viewport contains a line matching the pattern,
   * polling with flush at ~50ms intervals.
   * Throws if not found within timeoutMs.
   */
  waitFor(pattern: string | RegExp, timeoutMs?: number): Promise<string[]>;

  /**
   * Resize the virtual terminal.
   */
  resize(cols: number, rows: number): void;
}

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07|\x1b_.*?\x07/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/**
 * Create a test harness wrapping a VirtualTerminal.
 *
 * Usage:
 * ```ts
 * import { createTestHarness } from "@actant/tui/testing";
 * const { harness, terminal } = createTestHarness(80, 24);
 * const chatView = new ActantChatView(terminal);
 * chatView.start();
 * harness.sendInput("hello\r");
 * const lines = await harness.waitFor("hello");
 * ```
 */
export async function createTestHarness(
  cols = 80,
  rows = 24,
): Promise<{
  harness: TuiTestHarness;
  terminal: import("@mariozechner/pi-tui").Terminal;
}> {
  // Dynamic import to keep @xterm/headless out of the production bundle.
  // VirtualTerminal is published as a test utility in pi-tui's source,
  // but not in its dist. We reconstruct a compatible one using @xterm/headless.
  const xtermMod = await import("@xterm/headless");
  const XtermTerminal = xtermMod.default?.Terminal ?? xtermMod.Terminal;

  const xterm = new XtermTerminal({
    cols,
    rows,
    disableStdin: true,
    allowProposedApi: true,
  });

  let inputHandler: ((data: string) => void) | undefined;
  let resizeHandler: (() => void) | undefined;
  let _cols = cols;
  let _rows = rows;

  const terminal: import("@mariozechner/pi-tui").Terminal = {
    start(onInput, onResize) {
      inputHandler = onInput;
      resizeHandler = onResize;
      xterm.write("\x1b[?2004h");
    },
    async drainInput() { /* no-op */ },
    stop() {
      xterm.write("\x1b[?2004l");
      inputHandler = undefined;
      resizeHandler = undefined;
    },
    write(data: string) {
      xterm.write(data);
    },
    get columns() { return _cols; },
    get rows() { return _rows; },
    get kittyProtocolActive() { return true; },
    moveBy(lines: number) {
      if (lines > 0) xterm.write(`\x1b[${lines}B`);
      else if (lines < 0) xterm.write(`\x1b[${-lines}A`);
    },
    hideCursor() { xterm.write("\x1b[?25l"); },
    showCursor() { xterm.write("\x1b[?25h"); },
    clearLine() { xterm.write("\x1b[K"); },
    clearFromCursor() { xterm.write("\x1b[J"); },
    clearScreen() { xterm.write("\x1b[2J\x1b[H"); },
    setTitle(title: string) { xterm.write(`\x1b]0;${title}\x07`); },
  };

  function flush(): Promise<void> {
    return new Promise((resolve) => {
      xterm.write("", () => resolve());
    });
  }

  function getViewport(): string[] {
    const lines: string[] = [];
    const buffer = xterm.buffer.active;
    for (let i = 0; i < _rows; i++) {
      const line = buffer.getLine(buffer.viewportY + i);
      lines.push(line ? line.translateToString(true) : "");
    }
    return lines;
  }

  const harness: TuiTestHarness = {
    sendInput(data: string) {
      inputHandler?.(data);
    },

    async getViewport() {
      await flush();
      return getViewport();
    },

    async getViewportText() {
      const vp = await this.getViewport();
      return vp.map((l) => stripAnsi(l)).join("\n");
    },

    async waitFor(pattern, timeoutMs = 5000) {
      const isRegex = pattern instanceof RegExp;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        await flush();
        const vp = getViewport();
        const match = vp.some((line) => {
          const plain = stripAnsi(line);
          return isRegex ? pattern.test(plain) : plain.includes(pattern);
        });
        if (match) return vp;
        await new Promise((r) => setTimeout(r, 50));
      }
      const vp = getViewport();
      const text = vp.map((l) => stripAnsi(l)).join("\n");
      throw new Error(
        `waitFor("${pattern}") timed out after ${timeoutMs}ms.\nViewport:\n${text}`,
      );
    },

    resize(newCols: number, newRows: number) {
      _cols = newCols;
      _rows = newRows;
      xterm.resize(newCols, newRows);
      resizeHandler?.();
    },
  };

  return { harness, terminal };
}
