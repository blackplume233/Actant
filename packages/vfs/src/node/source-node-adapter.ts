import type {
  VfsEntry,
  VfsFileContent,
  VfsListOptions,
  VfsResolveResult,
  VfsStatResult,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared";
import type { VfsRequestContext, VfsStreamChunk } from "../namespace/canonical-path";

class AsyncPushIterator<T> implements AsyncIterable<T>, AsyncIterator<T> {
  private readonly buffered: T[] = [];
  private readonly waiting: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) {
      return;
    }

    const resolver = this.waiting.shift();
    if (resolver) {
      resolver({ value, done: false });
      return;
    }

    this.buffered.push(value);
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    while (this.waiting.length > 0) {
      const resolver = this.waiting.shift();
      resolver?.({ value: undefined, done: true });
    }
  }

  async next(): Promise<IteratorResult<T>> {
    const buffered = this.buffered.shift();
    if (buffered != null) {
      return { value: buffered, done: false };
    }

    if (this.closed) {
      return { value: undefined, done: true };
    }

    return new Promise<IteratorResult<T>>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  async return(): Promise<IteratorResult<T>> {
    this.close();
    return { value: undefined, done: true };
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this;
  }
}

export class SourceNodeAdapter {
  constructor(private readonly resolved: VfsResolveResult) {}

  async readFile(_context: VfsRequestContext): Promise<VfsFileContent> {
    const handler = this.resolved.source.handlers.read;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.source.name}" does not support read`);
    }

    return handler(this.resolved.relativePath);
  }

  async writeFile(
    content: string | Uint8Array,
    _context: VfsRequestContext,
  ): Promise<VfsWriteResult> {
    const handler = this.resolved.source.handlers.write;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.source.name}" does not support write`);
    }

    const normalizedContent = typeof content === "string"
      ? content
      : new TextDecoder().decode(content);

    return handler(this.resolved.relativePath, normalizedContent);
  }

  async readDir(
    _context: VfsRequestContext,
    options?: VfsListOptions,
  ): Promise<VfsEntry[]> {
    const handler = this.resolved.source.handlers.list;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.source.name}" does not support list`);
    }

    return handler(this.resolved.relativePath, options);
  }

  async stat(_context: VfsRequestContext): Promise<VfsStatResult | null> {
    if (!this.resolved.relativePath) {
      return {
        size: 0,
        mtime: new Date(0).toISOString(),
        type: "directory",
      };
    }

    const handler = this.resolved.source.handlers.stat;
    if (handler) {
      return handler(this.resolved.relativePath);
    }

    if (this.resolved.fileSchema) {
      return {
        size: 0,
        mtime: new Date(0).toISOString(),
        type: this.resolved.fileSchema.type === "directory" ? "directory" : "file",
        mimeType: this.resolved.fileSchema.mimeType,
      };
    }

    return null;
  }

  async watch(
    _context: VfsRequestContext,
    options?: VfsWatchOptions,
  ): Promise<AsyncIterable<VfsWatchEvent>> {
    const handler = this.resolved.source.handlers.watch;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.source.name}" does not support watch`);
    }

    const iterator = new AsyncPushIterator<VfsWatchEvent>();
    const dispose = handler(
      this.resolved.relativePath,
      (event: VfsWatchEvent) => iterator.push(event),
      options,
    );

    return {
      [Symbol.asyncIterator](): AsyncIterator<VfsWatchEvent> {
        const baseIterator = iterator[Symbol.asyncIterator]();
        return {
          next: () => baseIterator.next(),
          return: async () => {
            dispose();
            iterator.close();
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  async stream(_context: VfsRequestContext): Promise<AsyncIterable<VfsStreamChunk>> {
    const readable = this.resolved.source.handlers.read;
    const supportsSyntheticStream = this.resolved.fileSchema?.type === "stream" && readable != null;

    if (!supportsSyntheticStream) {
      throw new Error(`Mount "${this.resolved.source.name}" does not support stream`);
    }

    const path = this.resolved.relativePath;
    const handler = readable;

    return {
      async *[Symbol.asyncIterator](): AsyncGenerator<VfsStreamChunk> {
        const content = await handler(path);
        yield {
          content: content.content,
          mimeType: content.mimeType,
          encoding: content.encoding,
          timestamp: Date.now(),
        };
      },
    };
  }
}
