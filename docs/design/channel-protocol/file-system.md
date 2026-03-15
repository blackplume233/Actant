# File System

**副标题**：Host file I/O services

---

## Overview

文件系统方法允许 Backend 在 Host 环境中读写文件。能够自行完成文件 I/O 的 Backend（例如 Claude SDK）不需要这些服务。ACP-EX 对应 ACP 的 `fs/read_text_file` 和 `fs/write_text_file`。

---

## Checking Support

- Backend 声明 `capabilities.needsFileIO = true` 时，表示需要这些服务
- 当 Backend 需要时，Host MUST 在 ChannelHostServices 中提供 `readTextFile` 和 `writeTextFile`
- 若 `capabilities.needsFileIO = false`，Backend 将不会调用这些方法

---

## ChannelHostServices.readTextFile()

> 从 Host 文件系统读取文件内容。

**Profile**：Core  
**ACP Equivalent**：`fs/read_text_file`

### Signature

```typescript
readTextFile?(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
```

### ReadTextFileRequest

```typescript
interface ReadTextFileRequest {
  sessionId: string;
  path: string;
  line?: number;
  limit?: number;
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| sessionId | string | Yes | Session ID |
| path | string | Yes | 文件绝对路径 |
| line | number | No | 1-based 起始行号 |
| limit | number | No | 最大读取行数 |

### ReadTextFileResponse

```typescript
interface ReadTextFileResponse {
  content: string;
}
```

| 字段 | 类型 | 描述 |
|------|------|------|
| content | string | 文件内容 |

### Behavior

- 所有文件路径 MUST 为绝对路径
- Host SHOULD 若可用则返回未保存的编辑器状态（与 ACP 一致）
- 若文件不存在，Host MUST 返回错误

---

## ChannelHostServices.writeTextFile()

> 将内容写入 Host 文件系统。

**Profile**：Core  
**ACP Equivalent**：`fs/write_text_file`

### Signature

```typescript
writeTextFile?(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
```

### WriteTextFileRequest

```typescript
interface WriteTextFileRequest {
  sessionId: string;
  path: string;
  content: string;
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| sessionId | string | Yes | Session ID |
| path | string | Yes | 文件绝对路径 |
| content | string | Yes | 要写入的内容 |

### WriteTextFileResponse

```typescript
interface WriteTextFileResponse {
  // empty on success
}
```

成功时返回空对象。

### Behavior

- 若文件不存在，Host MUST 创建该文件
- 所有路径 MUST 为绝对路径
