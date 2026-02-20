# AgentCraft Landing Page — Content Blueprint

> 核心叙事：
> 1. **Docker 思维** — AgentCraft 对 AI Agent 做的事 = Docker 对进程做的事
> 2. **共享 & 嵌入愿景** — Agent 能进化、能共享、能零成本嵌入工作流

---

## Section 1: Hero

### Headline
The **Docker** for AI Agents

### Subheadline
Build once, run anywhere. 像管理容器一样管理 AI Agent —
从 Template 定义到 Instance 运行，从单次任务到持久化虚拟雇员。

### Supporting Copy
AgentCraft 是 AI Agent 的运行时平台。用声明式 Template 定义 Agent 的能力，
一条命令创建隔离的运行实例，通过标准协议无缝嵌入你的工作流。

### Hero Badge
Open Source — 面向复杂业务场景的 Agent 编排框架

---

## Section 2: Docker Analogy (核心叙事 #1)

### Section Title
If you understand Docker, you understand AgentCraft

### Tagline
同样的分层思维，同样的声明式定义，同样的 CLI/Daemon 架构。
只是这次管理的不是容器，而是 AI Agent。

### Analogy Table (视觉化对照)

| Docker | AgentCraft | 本质 |
|--------|-----------|------|
| Dockerfile | Agent Template (JSON) | 声明式定义"这个 Agent 是什么" |
| Image | Registry 中的 Template | 已验证、可复用、可分发的定义 |
| Container | Agent Instance (workspace) | 从定义实例化出的运行单元，有自己的文件系统 |
| docker run | agent create + start | 创建实例并启动 |
| docker ps | agent list | 查看所有实例状态 |
| docker stop / rm | agent stop / destroy | 停止或销毁实例 |
| Volume | Domain Context (物化文件) | 实例的持久化配置 |
| Container Writable Layer | Memory Layer (.memory/) | 运行时积累的可写状态 |
| Union FS | Template ∪ Memory 合并物化 | 只读模板层 + 可写记忆层的叠加 |
| docker commit | Memory → Shared Pool | 实例经验提升为可共享知识 |
| Network | ACP / MCP 协议 | 实例间及外部的通信通道 |
| dockerd | AgentCraft Daemon | 守护进程，管理一切 |
| docker CLI | agentcraft CLI | 薄客户端，与 daemon 交互 |

### Architecture Comparison (并排)

```
Docker:
docker CLI ──(REST/socket)──▶ dockerd ──▶ containerd ──▶ runc

AgentCraft:
agentcraft CLI ──(JSON-RPC/socket)──▶ Daemon ──▶ Launcher ──▶ Claude/Cursor
```

---

## Section 3: Agent 共享与嵌入工作流 (核心叙事 #2)

### Section Title
Agents that learn, share, and embed into your workflow

### Vision Statement
Agent 不应该每次启动都失忆。AgentCraft 让 Agent 在每次会话中积累经验，
跨实例共享知识，最终零成本嵌入你的开发、测试、运维工作流。

### 三层进化架构 (可视化)

```
Layer 3: Template Evolution (种群进化)
  ↑ 高置信度经验 + 人工审核 → Template 版本升级

Layer 2: Shared Memory (跨实例共享)
  ↑ confidence > threshold + 出现在 2+ 个 instances

Layer 1: Instance Memory (实例记忆)
  ↑ session end → 自动提取经验

Layer 0: Session (会话)
  Agent 在 context window 内工作，产出 diff / logs / artifacts
```

### 三个愿景卡片

#### Card 1: Agent 会进化
实例在多次会话间积累经验 — 错误模式、用户偏好、最佳实践。
下一次启动时，记忆自动注入，Agent 不再重复犯同样的错误。

像 Docker Container 的可写层一样，Memory Layer 是 Agent 的后天经验。
Template 不变 ≠ Agent 不变 — DNA 一生不变，但人一直在学习。

#### Card 2: Agent 会共享
当经验在多个实例中被验证（confidence > 阈值），自动提升到共享知识池。
实例 A 踩过的坑，实例 B 不再重蹈。

像 docker commit 将容器改动固化为镜像，Memory Promotion 将实例经验
固化为团队知识。

#### Card 3: Agent 嵌入工作流
- **One-Shot**: 在 CI/CD pipeline 中一次性执行任务后自动销毁
- **Service**: 作为持久化虚拟雇员接入 IM / Email
- **ACP Proxy**: 外部应用通过标准协议调用托管 Agent
- **MCP Server**: Agent 之间相互调用，组成协作网络

Agent 不是孤岛，是工作流中的一个节点。

---

## Section 4: How It Works (Flow)

### 思维: Template → Instance → Session → Memory → Evolution

1. **Define** — 用 JSON Template 声明 Agent 的 Skills、Prompts、MCP 工具
2. **Create** — AgentCraft 将 Template 物化为隔离的 Instance Workspace
3. **Run** — 通过 CLI 或 ACP 启动 Agent，选择合适的 LaunchMode
4. **Interact** — 发送任务、对话交互，Agent 在 workspace 内完成工作
5. **Evolve** — Session 结束后提取经验，下次启动时 Memory 自动注入

---

## Section 5: Terminal Demo

```bash
# 像 Docker 一样管理 Agent

$ agentcraft daemon start
✓ Daemon started (pid: 42851)

$ agentcraft template list                    # ≈ docker images
  code-review-agent    Code review + security audit
  bilibili-analyzer    Video content analysis

$ agentcraft agent create reviewer \
    --template code-review-agent              # ≈ docker run
✓ Agent created: reviewer
  Skills → AGENTS.md | Prompts → system.md | MCP → mcp.json

$ agentcraft agent run reviewer \
    --prompt "Review error handling in src/"   # ≈ docker exec
Analyzing... Found 3 issues.

$ agentcraft agent stop reviewer              # ≈ docker stop
✓ Memory extracted: 2 error patterns, 1 best practice

$ agentcraft agent start reviewer             # 再次启动时自动注入 Memory
✓ Re-materialized with 3 memory insights
```

---

## Section 6: Roadmap

### Phase 1: 核心运行时 ✅
进程管理、LaunchMode 分化、崩溃重启 — Agent 的 containerd

### Phase 2: Agent 拼装与交互 ✅
Domain Context 物化、CLI 交互 — Agent 的 docker build + docker exec

### Phase 3: 通信与协议 🔧
ACP Proxy + MCP Server — Agent 的 Network

### Phase 4: 扩展体系 📋
Plugin 架构 — Agent 的 Compose

### Phase 5: 记忆系统 📋
Memory Layer + 共享知识池 — Agent 的 Union FS + docker commit

### Phase 6: ACP-Fleet 🔮
Daemon → ACP Server — Agent 的 Swarm

---

## Section 7: CTA

### Headline
Ready to containerize your AI Agents?

### Body
开始用 Docker 的方式思考 AI Agent。
Define, Build, Ship, Run — 零成本嵌入你的工作流。

---

## Section 8: Footer

Built for developers who orchestrate AI.
MIT License | GitHub | Documentation
