import type {
  VfsEditResult,
  VfsEntry,
  VfsFileContent,
  VfsGlobOptions,
  VfsGrepOptions,
  VfsGrepResult,
  VfsListOptions,
  VfsResolveResult,
  VfsStatResult,
  VfsTreeNode,
  VfsTreeOptions,
  VfsWatchEvent,
  VfsWatchOptions,
  VfsWriteResult,
} from "@actant/shared/core";
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

function scopeGlobPattern(basePath: string, pattern: string): string {
  if (!basePath) {
    return pattern;
  }

  if (!pattern) {
    return `${basePath}/**`;
  }

  return `${basePath}/${pattern}`;
}

function relativeToBasePath(basePath: string, entryPath: string): string {
  if (!basePath || !entryPath) {
    return entryPath;
  }

  if (entryPath === basePath) {
    return "";
  }

  const prefix = `${basePath}/`;
  return entryPath.startsWith(prefix) ? entryPath.slice(prefix.length) : entryPath;
}

export class ResolvedNodeAdapter {
  constructor(private readonly resolved: VfsResolveResult) {}

  async readFile(_context: VfsRequestContext): Promise<VfsFileContent> {
    const handler = this.resolved.mount.handlers.read;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support read`);
    }

    return handler(this.resolved.relativePath);
  }

  async writeFile(
    content: string | Uint8Array,
    _context: VfsRequestContext,
  ): Promise<VfsWriteResult> {
    const handler = this.resolved.mount.handlers.write;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support write`);
    }

    const normalizedContent = typeof content === "string"
      ? content
      : new TextDecoder().decode(content);

    return handler(this.resolved.relativePath, normalizedContent);
  }

  async readRange(
    startLine: number,
    endLine?: number,
    _context?: VfsRequestContext,
  ): Promise<VfsFileContent> {
    const handler = this.resolved.mount.handlers.read_range;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support read_range`);
    }

    return handler(this.resolved.relativePath, startLine, endLine);
  }

  async editFile(
    oldStr: string,
    newStr: string,
    replaceAll?: boolean,
    _context?: VfsRequestContext,
  ): Promise<VfsEditResult> {
    const handler = this.resolved.mount.handlers.edit;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support edit`);
    }

    return handler(this.resolved.relativePath, oldStr, newStr, replaceAll);
  }

  async deleteFile(_context?: VfsRequestContext): Promise<void> {
    const handler = this.resolved.mount.handlers.delete;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support delete`);
    }

    await handler(this.resolved.relativePath);
  }

  async readDir(
    _context: VfsRequestContext,
    options?: VfsListOptions,
  ): Promise<VfsEntry[]> {
    const handler = this.resolved.mount.handlers.list;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support list`);
    }

    return handler(this.resolved.relativePath, options);
  }

  async stat(_context: VfsRequestContext): Promise<VfsStatResult | null> {
    if (!this.resolved.relativePath) {
      return {
        size: 0,
        mtime: new Date(0).toISOString(),
        type: "directory",
        nodeType: "directory",
      };
    }

    const handler = this.resolved.mount.handlers.stat;
    if (handler) {
      return handler(this.resolved.relativePath);
    }

    if (this.resolved.fileSchema) {
      const nodeType = this.resolved.fileSchema.type === "directory"
        ? "directory"
        : this.resolved.fileSchema.type === "control"
          ? "control"
          : this.resolved.fileSchema.type === "stream"
            ? "stream"
            : "regular";
      return {
        size: 0,
        mtime: new Date(0).toISOString(),
        type: this.resolved.fileSchema.type === "directory" ? "directory" : "file",
        nodeType,
        mimeType: this.resolved.fileSchema.mimeType,
      };
    }

    return null;
  }

  async tree(
    options?: VfsTreeOptions,
    _context?: VfsRequestContext,
  ): Promise<VfsTreeNode> {
    const handler = this.resolved.mount.handlers.tree;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support tree`);
    }

    return handler(this.resolved.relativePath, options);
  }

  async globFiles(
    pattern: string,
    options?: VfsGlobOptions,
    _context?: VfsRequestContext,
  ): Promise<string[]> {
    const handler = this.resolved.mount.handlers.glob;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support glob`);
    }

    const scopedOptions = this.resolved.relativePath
      ? { ...options, cwd: options?.cwd ?? this.resolved.relativePath }
      : options;

    return handler(pattern, scopedOptions);
  }

  async grepFiles(
    pattern: string,
    options?: VfsGrepOptions,
    _context?: VfsRequestContext,
  ): Promise<VfsGrepResult> {
    const handler = this.resolved.mount.handlers.grep;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support grep`);
    }

    const scopedOptions = this.resolved.relativePath
      ? {
        ...options,
        glob: scopeGlobPattern(this.resolved.relativePath, options?.glob ?? "**"),
      }
      : options;

    const result = await handler(pattern, scopedOptions);
    if (!this.resolved.relativePath) {
      return result;
    }

    return {
      ...result,
      matches: result.matches.map((match) => ({
        ...match,
        path: relativeToBasePath(this.resolved.relativePath, match.path),
      })),
    };
  }

  async watch(
    _context: VfsRequestContext,
    options?: VfsWatchOptions,
  ): Promise<AsyncIterable<VfsWatchEvent>> {
    const handler = this.resolved.mount.handlers.watch;
    if (!handler) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support watch`);
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
    const streamHandler = this.resolved.mount.handlers.stream;
    if (streamHandler) {
      return streamHandler(this.resolved.relativePath);
    }

    const readable = this.resolved.mount.handlers.read;
    const supportsSyntheticStream = this.resolved.fileSchema?.type === "stream" && readable != null;

    if (!supportsSyntheticStream) {
      throw new Error(`Mount "${this.resolved.mount.name}" does not support stream`);
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
