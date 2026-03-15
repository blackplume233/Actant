# Content

**副标题**：Content block types in ACP-EX

---

## Overview

Content block 表示协议中流动的可展示信息。出现在：session update 事件（agent_message_chunk、tool_call_update）、prompt 结果等。ACP-EX 的 Core 类型与 ACP 使用相同的 ContentBlock 结构（ACP 本身复用 MCP 类型）。Extended Profile 增加 `x_structured`。

---

## ChannelContent

```typescript
type ChannelContent =
  | TextContent
  | ImageContent
  | AudioContent
  | ResourceContent
  | ResourceLinkContent
  | StructuredContent;
```

---

## TextContent

> 纯文本内容。大多数交互的基础。

**Profile**：Core  
**ACP Equivalent**：`ContentBlock type="text"`  
**Support**：所有 Backend MUST 支持 text content。

```typescript
interface TextContent {
  kind: "text";
  text: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| kind | "text" | Content 类型判别符 |
| text | string | 要展示的文本内容 |

---

## ImageContent

> Base64 编码的图片数据。

**Profile**：Core  
**ACP Equivalent**：`ContentBlock type="image"`  
**Support**：需要 `capabilities.contentTypes` 包含 `"image"`

```typescript
interface ImageContent {
  kind: "image";
  data: string;
  mimeType: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| kind | "image" | Content 类型判别符 |
| data | string | Base64 编码的图片数据 |
| mimeType | string | MIME 类型（如 `"image/png"`、`"image/jpeg"`） |

---

## AudioContent

> Base64 编码的音频数据。

**Profile**：Core  
**ACP Equivalent**：`ContentBlock type="audio"`  
**Support**：需要 `capabilities.contentTypes` 包含 `"audio"`

```typescript
interface AudioContent {
  kind: "audio";
  data: string;
  mimeType: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| kind | "audio" | Content 类型判别符 |
| data | string | Base64 编码的音频数据 |
| mimeType | string | MIME 类型 |

---

## ResourceContent

> 内嵌资源内容。

**Profile**：Core  
**ACP Equivalent**：`ContentBlock type="resource"`  
**Support**：需要 `capabilities.contentTypes` 包含 `"resource"`

```typescript
interface ResourceContent {
  kind: "resource";
  uri: string;
  content?: string;
  mimeType?: string;
}
```

| Field | Type | Description |
|-------|------|-------------|
| kind | "resource" | Content 类型判别符 |
| uri | string | 标识资源的 URI |
| content | string? | 内联资源内容 |
| mimeType | string? | 资源的 MIME 类型 |

---

## ResourceLinkContent

> 对 Backend 可访问资源的引用。

**Profile**：Core  
**ACP Equivalent**：`ContentBlock type="resource_link"`

```typescript
interface ResourceLinkContent {
  kind: "resource_link";
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
}
```

| Field | Type | Description |
|-------|------|-------------|
| kind | "resource_link" | Content 类型判别符 |
| uri | string | 资源 URI |
| name | string? | 资源名称 |
| mimeType | string? | MIME 类型 |
| size | number? | 资源大小（字节） |

---

## StructuredContent (Extended)

> 带 schema 引用的结构化数据。

**Profile**：Extended  
**ACP Equivalent**：None  
**Support**：需要 `capabilities.structuredOutput = true`

```typescript
interface StructuredContent {
  kind: "x_structured";
  schema: string;
  data: unknown;
}
```

| Field | Type | Description |
|-------|------|-------------|
| kind | "x_structured" | Content 类型判别符。按 ACP-EX 约定使用 `x_` 前缀。 |
| schema | string | Schema 标识符或 JSON Schema 引用 |
| data | unknown | 符合 schema 的结构化数据 |
