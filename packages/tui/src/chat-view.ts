import chalk from "chalk";
import {
  TUI,
  Text,
  Editor,
  Loader,
  Markdown,
  Spacer,
  matchesKey,
  Key,
  type Terminal,
  type Component,
  CombinedAutocompleteProvider,
} from "@mariozechner/pi-tui";
import type { StreamChunk } from "@actant/core";
import { actantEditorTheme, actantMarkdownTheme } from "./theme.js";
import { StreamingMarkdown } from "./streaming-markdown.js";

export interface ChatViewOptions {
  title?: string;
  subtitle?: string;
  slashCommands?: Array<{ name: string; description: string }>;
  cwd?: string;
}

type MessageHandler = (text: string) => Promise<void>;

/**
 * High-level chat view component that combines pi-tui primitives
 * into a full agent chat experience.
 *
 * Manages: welcome banner, message history (Markdown), Editor input,
 * Loader animation, and streaming response rendering.
 */
export class ActantChatView {
  readonly tui: TUI;
  private editor: Editor;
  private loader: Loader | null = null;
  private isResponding = false;
  private messageHandler: MessageHandler | null = null;
  private exitHandler: (() => Promise<void>) | null = null;
  private cancelHandler: (() => void) | null = null;
  private _currentStreaming: StreamingMarkdown | null = null;
  private stopped = false;
  private inputListener: (() => void) | null = null;

  constructor(terminal: Terminal, options?: ChatViewOptions) {
    this.tui = new TUI(terminal);

    const title = options?.title ?? "Actant Chat";
    const subtitle = options?.subtitle ?? 'Type your message below. Press Escape to cancel. Type "/exit" to quit.';
    this.tui.addChild(
      new Text(`${chalk.bold.cyan(title)}\n${chalk.dim(subtitle)}`, 1, 1),
    );
    this.tui.addChild(new Spacer(1));

    this.editor = new Editor(this.tui, actantEditorTheme);
    if (options?.slashCommands || options?.cwd) {
      const provider = new CombinedAutocompleteProvider(
        [
          { name: "exit", description: "Exit the chat" },
          ...(options?.slashCommands ?? []),
        ],
        options?.cwd ?? process.cwd(),
      );
      this.editor.setAutocompleteProvider(provider);
    }

    this.editor.onSubmit = (text: string) => {
      this.handleSubmit(text);
    };

    this.tui.addChild(this.editor);
    this.tui.setFocus(this.editor);
  }

  get currentStreaming(): StreamingMarkdown | null {
    return this._currentStreaming;
  }

  get responding(): boolean {
    return this.isResponding;
  }

  /**
   * Register the callback invoked when the user submits a message.
   * The handler receives the trimmed text and should drive the
   * channel interaction (prompt → stream → done).
   */
  set onUserMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  /**
   * Register a callback for when the user requests exit (/exit or Escape idle).
   */
  set onExit(handler: () => Promise<void>) {
    this.exitHandler = handler;
  }

  /**
   * Register a callback for when the user cancels an in-progress response.
   */
  set onCancel(handler: () => void) {
    this.cancelHandler = handler;
  }

  start(): void {
    this.inputListener = this.tui.addInputListener((data) => {
      if (matchesKey(data, Key.escape)) {
        if (this.isResponding) {
          this.cancelCurrentResponse();
          return { consume: true };
        }
      }
      return undefined;
    });
    this.tui.start();
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.loader) {
      this.loader.stop();
      this.tui.removeChild(this.loader);
      this.loader = null;
    }
    if (this.inputListener) {
      this.inputListener();
      this.inputListener = null;
    }
    this.tui.stop();
  }

  /**
   * Append a user message bubble to the chat history.
   */
  appendUserMessage(text: string): void {
    const msg = new Markdown(
      text,
      1, 0,
      actantMarkdownTheme,
      { color: (t) => chalk.green(t) },
    );
    this.insertBeforeEditor(msg);
    this.insertBeforeEditor(new Spacer(1));
    this.tui.requestRender();
  }

  /**
   * Show the loading spinner. Returns the Loader so caller can stop it.
   */
  showLoader(message = "Thinking..."): void {
    if (this.loader) return;
    this.loader = new Loader(
      this.tui,
      (s) => chalk.cyan(s),
      (s) => chalk.dim(s),
      message,
    );
    this.insertBeforeEditor(this.loader);
    this.tui.requestRender();
  }

  hideLoader(): void {
    if (!this.loader) return;
    this.loader.stop();
    this.tui.removeChild(this.loader);
    this.loader = null;
    this.tui.requestRender();
  }

  /**
   * Create a StreamingMarkdown component, insert it into the view,
   * and consume the given stream. Automatically hides the loader
   * when the first chunk arrives and re-enables the editor when done.
   */
  async appendAssistantStream(stream: AsyncIterable<StreamChunk>): Promise<string> {
    this.hideLoader();

    const streaming = new StreamingMarkdown(actantMarkdownTheme, this.tui, 1, 0);
    this._currentStreaming = streaming;
    this.insertBeforeEditor(streaming);
    this.tui.requestRender();

    let result: string;
    try {
      result = await streaming.consumeStream(stream);
    } finally {
      this._currentStreaming = null;
      this.insertBeforeEditor(new Spacer(1));
      this.finishResponse();
    }
    return result;
  }

  /**
   * Append a simple text response (non-streaming, e.g. from RPC result).
   */
  appendAssistantMessage(text: string): void {
    const msg = new Markdown(text, 1, 0, actantMarkdownTheme);
    this.insertBeforeEditor(msg);
    this.insertBeforeEditor(new Spacer(1));
    this.tui.requestRender();
  }

  private handleSubmit(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.isResponding) return;

    if (trimmed === "/exit") {
      void this.handleExit();
      return;
    }

    this.isResponding = true;
    this.editor.disableSubmit = true;
    this.appendUserMessage(trimmed);
    this.showLoader();

    void (async () => {
      try {
        if (this.messageHandler) {
          await this.messageHandler(trimmed);
        }
      } catch (err) {
        this.hideLoader();
        const msg = err instanceof Error ? err.message : String(err);
        const errMd = new Markdown(
          `**Error:** ${msg}`,
          1, 0,
          actantMarkdownTheme,
        );
        this.insertBeforeEditor(errMd);
        this.insertBeforeEditor(new Spacer(1));
        this.finishResponse();
      }
    })();
  }

  private finishResponse(): void {
    this.isResponding = false;
    this.editor.disableSubmit = false;
    this.tui.setFocus(this.editor);
    this.tui.requestRender();
  }

  private cancelCurrentResponse(): void {
    this.cancelHandler?.();
  }

  private async handleExit(): Promise<void> {
    if (this.exitHandler) {
      await this.exitHandler();
    }
    await this.stop();
  }

  private insertBeforeEditor(component: Component): void {
    const children = this.tui.children;
    const editorIdx = children.indexOf(this.editor);
    if (editorIdx >= 0) {
      children.splice(editorIdx, 0, component);
    } else {
      children.push(component);
    }
  }
}
