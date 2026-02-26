# Actant Landing Page — Content Blueprint

> 核心叙事：
> 1. **Actant 品牌语义** — 行动者：跨学科概念（叙事学、ANT、Actor Model）
> 2. **能力展示** — 6 大核心功能 + 3 个真实使用场景
> 3. **进化愿景** — Agent 能进化、能共享、能零成本嵌入工作流

---

## Section 1: Hero

### Headline
The **Docker** for AI Agents

### Subheadline (Slogan only — 不展开类比)
声明式定义 Agent 能力，一条命令创建隔离实例，在 CI、IM、IDE 中无缝运行。
开源 AI Agent 运行时平台。

### Hero Badge
Open Source — Agent Runtime Platform

---

## Section 2: Identity — "Actant — 行动者"

### Section Title
Actant — 行动者

### Tagline
一个跨学科的概念。在叙事学、社会学和计算机科学中，
Actant 都指向同一件事：能够独立行动并产生影响的实体。

### 三列卡片

#### Card 1: Narratology · 叙事学
推动剧情的角色
Greimas 行动元模型中，Actant 是故事中推动事件发展的核心角色元素。
你的工作流就是一个故事，Agent 是其中的行动者。

#### Card 2: ANT · 行动者网络理论
网络中的作用实体
Latour 的行动者网络理论中，Actant 是任何在网络中产生效果的实体 —
无论人或非人。AI Agent 就是数字世界中的 Actant。

#### Card 3: Actor Model · 并发计算
自治的执行单元
同根词 act-：在并发计算的 Actor Model 中，每个 Actor 是独立的、
消息驱动的执行单元。每个 Agent Instance 就是一个 Actor。

### Summary
Actant = 一个能独立行动、在网络中产生影响、持续进化的实体。
这就是我们对 AI Agent 的定义。

---

## Section 3: Capabilities — "What Actant Can Do"

### Section Title
What Actant Can Do

### Tagline
从定义到运行，从单机到协作，覆盖 AI Agent 全生命周期的核心能力。

### 6 格 Grid

1. **Agent Template** — 声明式 JSON 定义 Skills、Prompts、MCP、Workflow，一次定义到处复用
2. **Multi-Backend** — 支持 Claude Code、Cursor、Cursor Agent、Pi、Custom 多种 AI 后端
3. **Component Sources** — 从 GitHub/本地同步组件，Preset 一键批量应用
4. **Employee Scheduler** — Heartbeat/Cron/Hook 三种输入，优先级任务队列
5. **ACP/MCP Integration** — 标准协议通信，Agent 可被外部调用或相互协作
6. **Extensibility** — Plugin 体系、ComponentTypeHandler 注册、自定义后端接入

---

## Section 4: Use Cases — "Agent 在真实场景中工作"

### Section Title
Agent 在真实场景中工作

### Tagline
从一次性 CI 任务到持久化虚拟雇员，从内部工具到标准协议外部接入。

### 三个场景 (左文字 + 右代码)

#### Use Case 1: CI Integration
CI/CD 一次性任务
在 GitHub Actions 或 Jenkins 中，用 one-shot 模式创建 Agent 执行代码审查、
安全扫描或文档生成。任务完成后实例自动销毁。

```bash
$ actant agent create ci-reviewer -t code-review-agent
$ actant agent run ci-reviewer --one-shot \
    --prompt "Review this PR for security issues"
✓ Task completed. Instance destroyed.
```

#### Use Case 2: Virtual Employee
持久化虚拟雇员
配置 Heartbeat 心跳和 Cron 定时任务，Agent 作为 acp-service 持久运行。
每日自动巡检 PR、生成周报、监控代码质量。

```bash
$ actant agent create pr-patrol -t pr-patrol-agent
$ actant agent start pr-patrol --launch-mode acp-service
✓ Employee agent running (heartbeat: 30s)

$ actant scheduler status pr-patrol
  Next cron: 09:00 daily · Heartbeat: active
```

#### Use Case 3: ACP Service
外部应用接入
Unreal Engine、Unity 或任何支持 ACP 协议的客户端通过标准协议调用
Actant 托管的 Agent。Agent 成为应用架构中的智能服务节点。

```bash
$ actant agent create game-ai -t game-assistant
$ actant agent start game-ai --launch-mode acp-service
✓ ACP endpoint ready: ws://localhost:3100
```

---

## Section 5: Demo — "从启动到进化，一气呵成"

### Section Title
从启动到进化，一气呵成

### Tagline
Daemon 管理生命周期，Template 定义能力，Memory 积累经验。

```bash
# 启动 Daemon 守护进程
$ actant daemon start
✓ Daemon started (pid: 42851)

# 查看可用 Agent 模板
$ actant template list
  code-review-agent    Code review + security audit
  bilibili-analyzer    Video content analysis

# 从模板创建 Agent 实例
$ actant agent create reviewer --template code-review-agent
✓ Agent created: reviewer
  Skills → AGENTS.md | Prompts → system.md | MCP → mcp.json

# 向 Agent 发送任务
$ actant agent run reviewer --prompt "Review error handling in src/"
Analyzing... Found 3 issues.

# 停止实例，自动提取经验
$ actant agent stop reviewer
✓ Memory extracted: 2 error patterns, 1 best practice

# 再次启动 — 带着记忆，不再失忆
$ actant agent start reviewer
✓ Re-materialized with 3 memory insights
```

---

## Section 6: Vision — "Agents that learn, share, embed"

### Section Title
Agents that learn, share, and embed into your workflow

### Vision Statement
Agent 不应该每次启动都失忆。让它进化、共享知识、成为工作流中可插拔的节点。

### 四层进化架构

```
Layer 3: Template Evolution (种群进化)
Layer 2: Shared Memory (跨实例共享)
Layer 1: Instance Memory (实例记忆)
Layer 0: Session (会话)
```

### 三个愿景卡片

#### Card 1: Evolve — Agent 会进化
实例在多次会话间积累经验。进化发生在 Memory Layer。

#### Card 2: Share — Agent 会共享
Memory Promotion 将实例经验固化为团队知识。

#### Card 3: Embed — Agent 嵌入工作流
One-Shot (CI) / Service (虚拟雇员) / ACP Proxy / MCP 协作。

---

## Section 7: Lifecycle Flow

Define → Create → Run → Interact → Evolve

---

## Section 8: Roadmap

### Section Title
Building the full stack

### Tagline
从核心运行时到记忆系统，一步一个脚印构建完整的 Agent 基础设施。

| Phase | Status | Focus |
|-------|--------|-------|
| Phase 1 · Runtime | Done | 进程管理、LaunchMode 分化、崩溃重启 |
| Phase 2 · Assemble | Done | Domain Context 物化、CLI 交互 |
| Phase 3 · Connect | Done | ACP Proxy · 组件 CRUD · Scheduler · Source |
| Phase 4 · Autonomy | Active | Hook · Plugin · Agent-to-Agent · Pi 后端 |
| Phase 5 · Memory | Planned | Memory Layer · 共享知识池 · 经验进化 |
| Phase 6 · Fleet | Vision | Daemon → ACP Server · 多节点协调 |

---

## Section 9: Stats

v0.2.2 数据：16K+ Lines of Code | 669 Tests | 62 RPC Methods | 68 CLI Commands

---

## Section 10: CTA

### Headline
让 AI Agent 成为你工作流中的 Actant

### Body
Define. Create. Run. Evolve. — 从定义到进化，一站式 Agent 管理。

---

## Section 11: Footer

Built for developers who orchestrate AI.
MIT License | GitHub | Documentation
