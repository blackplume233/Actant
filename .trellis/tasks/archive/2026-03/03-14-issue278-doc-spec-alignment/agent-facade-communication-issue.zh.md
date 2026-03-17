# Actant 对外应表现为稳定 Agent Runtime Facade（Claude Code 仅为内部后端适配器）

## 背景

随着 `repo -> service -> employee` archetype 模型逐渐收敛，Actant 对外已经不应继续被理解为“只是一个启动 Claude Code / ACP bridge 的管理器”。

对于外部调用方来说——无论是 CLI、Dashboard、IDE 通过 ACP 接入、REST/RPC 客户端，还是未来的 agent-to-agent communication——目标都应该是一个**稳定、统一、可被理解为 Agent 的 Actant runtime facade**：

- 调用方面对的是 **Actant Agent / Actant Service Runtime**
- 而不是某个 `claude-code` bridge binary、某个 backend session、或某条偶然存在的通信路径

这意味着：

1. Actant 对外应像一个稳定 Agent runtime facade
2. `Claude Code` 应明确降级为**内部 backend adapter**，而不是产品层主语
3. 外部与内部通信应共享一套通信模型，而不是 CLI / proxy / Dashboard / internal 各讲各的话
4. 运行中的 `service` 应被视为共享 communication target，而不是“已占用实例，需要默认 fallback 成新的 ephemeral 进程”

近期 spec sync 已在 `.trellis/spec/communication-layer.md` 建立了统一通信层基线，但仍需要一个更清晰的母 issue，收口这个产品 framing，并明确后续 runtime / protocol / surface 收敛工作。

## 问题

当前仓库里关于 Actant 对外身份与通信协议的理解仍然存在几类不一致：

### 1. 对外主语仍会滑回 backend

尽管产品上更合理的模型应该是“Actant Service / Actant Agent”，但实现和历史文档里仍然容易把：

- `claude-code`
- ACP bridge
- backend session
- 进程 spawn 方式

直接暴露为调用方真正面对的对象。

结果是：调用方在概念上面对的是 backend，而不是 Actant runtime facade。

### 2. 通信 surface 长期分裂

当前与 `service` 通信的路径分布在：

- `agent.prompt`
- `agent.run`
- `proxy`
- Dashboard session / lease
- backend capability quirks

这些 surface 之间长期存在语义漂移：

- 哪条是主路径
- running 是否意味着 ready
- proxy 默认应接入共享 service 还是 direct bridge
- internal communication 是否和 external communication 是同一个模型

### 3. `service` 的 shared-runtime 含义不够稳定

产品上 `service` 已经应当是：

- 默认主交付形态
- 被多个调用方复用的共享 runtime
- 通过 lease / session / conversation 路由的 communication target

但历史叙事和部分代码路径仍会把 running service 解释为：

- 一个“已经占用”的实例
- 因此 proxy/chat 更自然地走 direct bridge 或 ephemeral fallback

这与当前产品方向不一致。

### 4. 内部通信与外部通信还没有彻底统一

未来无论是：

- 人类用户通过 CLI / Dashboard
- IDE 通过 ACP
- 外部系统通过 REST/RPC
- 另一个 Actant Agent 通过 internal communication

都应该面对**同一套通信协议语义**：

- target
- route
- lease
- conversation
- readiness
- facade

而不是各自形成一套独立模型。

## 目标

本 issue 的目标是正式定义并推动以下基线：

### 1. Actant 对外是 Agent Runtime Facade

对外产品语义中，Actant 应表现为：

- Actant Agent
- Actant Service Runtime
- Actant lease / conversation / prompt target

外部不应优先感知到 `claude-code`、ACP bridge、backend session 等内部细节。

### 2. Claude Code 是内部 backend adapter

`claude-code` 的定位应当是：

- managed primary backend adapter
- 为 Actant runtime facade 提供底层能力的实现方式之一
- 可被后续 `pi` 或其他 runtime 替换的内部实现层

而不是产品层对外对象本身。

### 3. 建立统一通信协议模型

所有 communication surface 最终都应映射到统一通信层模型：

- runtime target
- route
- lease
- conversation
- readiness
- backend adapter delivery

也就是说：

- CLI
- Dashboard
- ACP proxy
- REST/RPC
- internal agent-to-agent communication

都只是统一通信模型的不同入口，而不是不同协议宇宙。

### 4. 让 running service 稳定等价于 communication-ready shared target

对 `service`：

- running 的目标语义应是 communication-ready
- `proxy` 对运行中的 `service` 默认应走 lease-first shared runtime access
- `agent.prompt` 应是运行中 service 的正式 prompt surface
- `run` 可以保留，但它不是 shared service 的主契约

## 方案草案

### A. 产品 framing

对外统一采用：

- Actant is the runtime facade
- service is the shared runtime communication target
- employee is service + autonomy
- repo is on-demand / workspace-carrier archetype

避免再让以下概念成为外部主语：

- Claude Code CLI
- ACP bridge binary
- backend-specific session ownership
- “proxy 只是直接把 stdin/stdout 转给 backend” 这类实现层说法

### B. 通信协议分层

建议把通信方案明确拆成四层：

```text
Caller Surface
  -> CLI / Dashboard / ACP / REST / Internal Agent Call
Communication Router
  -> route selection / readiness / lease / conversation
Runtime Facade
  -> Actant Agent / Actant Service Runtime
Backend Adapter
  -> claude-code / pi / future runtimes
```

关键点：

- 调用方命中的是 Runtime Facade
- Communication Router 是唯一的路由决策点
- Backend Adapter 只负责把请求翻译到后端

### C. 统一术语

建议强制收口以下术语：

| 术语 | 统一含义 |
|------|----------|
| `service` | 共享 managed runtime communication target |
| `lease` | 调用方与共享 runtime 的临时绑定 |
| `conversation` | 稳定逻辑对话线程，不等同于 ACP session |
| `readiness` | 可通信能力，不只是 process alive |
| `backend adapter` | `claude-code` 等内部实现桥接层 |
| `runtime facade` | 调用方真正面对的 Actant external identity |

### D. 统一 route 规则

建议继续收口为：

- running `service` -> `service-lease`
- service cold start / restore -> `service-direct-bootstrap`
- explicit isolation / compatibility -> `direct-bridge`
- one-shot task path -> `one-shot-run`
- internal service communication -> `internal-lease`

### E. internal / external 共模

无论 communication 是：

- external human/client -> Actant
- agent -> agent

都应该共享同一组模型对象：

- target
- route
- lease
- conversation
- readiness

也就是说，internal communication 不再被视为完全独立体系，而只是 transport 不同。

## 需要落实的工作

### 1. Spec / doc

- [ ] 把“Actant 对外像一个稳定 Agent / runtime facade”补入顶层产品/vision/framing 文档
- [ ] 统一 wiki / architecture / roadmap 中关于 `service`、`proxy`、`claude-code` 的叙事
- [ ] 明确 internal communication 与 external communication 的共模关系
- [ ] 为旧文档中 backend-first / direct-bridge-first 表述补充 superseded 或 alignment note

### 2. Runtime / router

- [ ] 抽象或显式固化 communication router
- [ ] 让 running `service` 的状态更明确表达 readiness，而非仅 process liveness
- [ ] 统一 `agent.prompt`、Dashboard session、proxy、future internal request 的 route 选择逻辑
- [ ] 将 backend capability 差异收拢在 adapter 层，而不是泄漏到对外产品语义

### 3. ACP / REST / CLI surface

- [ ] `proxy` 对 running service 默认走 lease-first
- [ ] `agent.chat` 对 running service 与 lease/session 语义对齐
- [ ] future REST chat / communication APIs 复用统一 communication router
- [ ] internal agent communication 复用同一 target / route / lease / conversation 语义

### 4. Verification

- [ ] 增加 `service start => communicationReady` 的验证口径
- [ ] 验证 `agent.prompt` 对 running service 可用
- [ ] 验证 `proxy` 默认 lease-first
- [ ] 验证 Dashboard 使用 session/lease 语义
- [ ] 验证 internal communication 与 external communication 的模型一致性

## 相关依据

- `.trellis/spec/communication-layer.md`
- `.trellis/spec/agent-lifecycle.md`
- `.trellis/spec/api-contracts.md`
- `.trellis/spec/config-spec.md`
- `.trellis/spec/session-management.md`
- `.trellis/tasks/03-14-qa-loop/qa-report-round1.md`
- `.trellis/tasks/03-14-faq-alignment-scan/issue-draft.zh.md`
- `.trellis/tasks/03-14-faq-alignment-scan/conflict-register.zh.md`
- `.trellis/tasks/03-14-faq-alignment-scan/repo-current-state.zh.md`

## 验收标准

- [ ] 团队接受“Actant 对外是 runtime facade，Claude Code 是内部 backend adapter”作为正式 framing
- [ ] 文档与 spec 中不再把 backend 当成外部主语
- [ ] `service` 的 shared-runtime / lease-first / readiness 语义在核心入口保持一致
- [ ] internal / external communication 被明确纳入同一协议模型
- [ ] 后续 runtime / protocol / verification 工作可从本 issue 拆分并追踪
