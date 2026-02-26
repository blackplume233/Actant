<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

Use the `/trellis:start` command when starting a new session to:
- Initialize your developer identity
- Understand current project context
- Read relevant guidelines

Use `@/.trellis/` to learn:
- Development workflow (`workflow.md`)
- Project structure guidelines (`spec/`)
- Developer workspace (`workspace/`)

## Code Intelligence (GitNexus MCP)

本项目已索引代码知识图谱（2091 符号、5354 关系、144 执行流）。
**修改核心模块前必须执行 impact 分析**。详见 `workflow.md` §Development Process。
索引过期时执行 `npx gitnexus analyze`。

Keep this managed block so 'trellis update' can refresh the instructions.

<!-- TRELLIS:END -->

## Key References

- **ACP (Agent Client Protocol)**: https://agentclientprotocol.com/llms.txt — 修改 ACP 相关代码/文档前必须先读取此索引，以官方定义为准
