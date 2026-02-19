# AgentCraft 架构 — Docker 类比

> AgentCraft 对 AI Agent 做的事，等同于 Docker 对进程做的事。

---

## 一、核心概念映射

| Docker | AgentCraft | 本质 |
|--------|-----------|------|
| **Dockerfile** | **Agent Template (JSON)** | 声明式定义"这个东西是什么" |
| **docker build** | **template validate + load** | 把声明构建为可用的镜像/模板 |
| **Image** | **Registry 中的 Template** | 已验证、可复用、可分发的定义 |
| **Container** | **Agent Instance (workspace dir)** | 从定义实例化出的运行单元，有自己的文件系统 |
| **docker run** | **agent create + start** | 创建实例并启动 |
| **docker ps** | **agent list** | 查看所有实例状态 |
| **docker stop** | **agent stop** | 停止实例 |
| **docker rm** | **agent destroy** | 删除实例（含文件系统） |
| **docker exec** | **(future) 向运行中 Agent 发任务** | 与活跃实例交互 |
| **Docker Hub / Registry** | **Template Registry** | 存储和分发模板 |
| **Volume** | **Domain Context (物化文件)** | 实例的持久化数据/配置 |
| **Network** | **MCP / ACP** | 实例间及外部的通信通道 |
| **Container Runtime (containerd)** | **Agent Launcher (Cursor/Claude Code)** | 真正执行工作的引擎 |
| **dockerd (daemon)** | **AgentCraft Daemon** | 持久进程，管理一切 |
| **docker CLI** | **agentcraft CLI** | 薄客户端，与 daemon 交互 |
| **Docker REST API** | **AgentCraft RPC/API** | daemon 对外暴露的编程接口 |
| **/var/run/docker.sock** | **~/.agentcraft/agentcraft.sock** | IPC 通道 |
| **Health Check** | **Agent 心跳** | 存活检测 |
| **Restart Policy** | **Agent 重启策略** | 崩溃恢复 |
| **docker-compose** | **Workflow + SubAgents** | 多实例编排 |
| **docker inspect** | **agent status --detail** | 查看实例完整状态 |

---

## 二、架构对照

### Docker 的分层

```
docker CLI ──(REST/socket)──▶ dockerd ──▶ containerd ──▶ runc
   薄客户端                      守护进程       容器运行时      实际执行
```

### AgentCraft 的分层

```
agentcraft CLI ──(JSON-RPC/socket)──▶ AgentCraft Daemon ──▶ Agent Launcher ──▶ Cursor/Claude Code
    薄客户端                              守护进程                启动器           实际执行的 AI Agent
```

---

## 三、交互模式对照

### One-shot 命令

```bash
# Docker
docker ps
docker run -d --name web nginx

# AgentCraft
agentcraft agent list
agentcraft agent create reviewer -t code-review-agent
```

两者行为一致：CLI 进程启动 → 连接 daemon socket → 发送请求 → 接收响应 → 格式化输出 → 退出。

### 交互式会话

```bash
# Docker (attach to container)
docker exec -it web bash

# AgentCraft (REPL mode)
agentcraft
> agent list
> agent create reviewer -t code-review-agent
> agent start reviewer
> agent status reviewer
```

### Daemon 生命周期

```bash
# Docker
systemctl start docker     # 启动 daemon
systemctl status docker    # 查看状态

# AgentCraft
agentcraft daemon start    # 启动 daemon
agentcraft daemon status   # 查看状态
agentcraft daemon stop     # 停止 daemon（会先优雅停止所有 Agent）
```

---

## 四、关键设计推论

从 Docker 类比中可以推导出的架构决策：

### 1. CLI 不含业务逻辑

就像 `docker` 二进制文件不包含容器管理逻辑一样，`agentcraft` CLI 只做：
- 解析命令行参数
- 序列化为 RPC 请求
- 发送到 daemon
- 反序列化响应
- 格式化输出到终端

### 2. Daemon 是唯一的状态拥有者

所有状态（Template Registry、Agent 进程、Instance 元数据缓存）都在 daemon 进程内存中。
CLI 是无状态的 — 每次调用都是一次独立的 RPC 请求。

### 3. Socket 文件 = 服务发现

`~/.agentcraft/agentcraft.sock` 的存在即表示 daemon 正在运行。
CLI 尝试连接 → 成功则发命令 → 失败则提示 "daemon not running"。

### 4. Daemon 可以做 CLI 做不到的事

- 长期监控 Agent 进程健康状态
- 崩溃自动重启
- 定时任务触发
- 事件驱动（webhook → 启动 Agent）
- 维护 Agent 间的通信通道

### 5. 多接口共享同一 Daemon

```
agentcraft CLI ──(Unix Socket)──┐
                                ├──▶ AgentCraft Daemon (Core Services)
REST Client    ──(HTTP)─────────┤
                                │
ACP Client     ──(ACP)─────────┘
```

所有接口最终调用同一套 Core Services，保证行为一致。

---

## 五、与现有代码的映射

| 概念 | 当前实现 | 目标 |
|------|---------|------|
| Template (Dockerfile) | `@agentcraft/core` template/ | ✅ 已完成 |
| Image (built template) | `TemplateRegistry` | ✅ 已完成 |
| Container (instance) | `AgentInitializer` + workspace dir | ✅ 已完成 |
| Volume (domain context) | `ContextMaterializer` + Domain Managers | ✅ 已完成 |
| Container Runtime | `AgentLauncher` interface + `MockLauncher` | 接口已定义，真实实现待做 |
| dockerd | **不存在** | 需要实现：`@agentcraft/api` 作为 daemon |
| docker CLI | `@agentcraft/cli`（当前是 one-shot 直接调用 core） | 需要重构为 RPC client |
| Docker API | **不存在** | 需要实现：JSON-RPC over Unix Socket |
| docker.sock | **不存在** | `~/.agentcraft/agentcraft.sock` |
