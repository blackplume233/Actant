# Actant Dashboard Archetype Random Walk QA Report

**Date:** 2025-02-27  
**Target:** http://localhost:3200  
**Locale:** zh-CN (Chinese)

---

## Summary

| Step | Description | Result |
|------|-------------|--------|
| S1 | Agents List - Archetype grouping | **PASS** |
| S2 | Agent Detail - Employee type | **PASS** |
| S3 | Agent Detail - Service type | **PASS** |
| S4 | Agent Detail - Repo/Tool type | **PASS** |
| S5 | Live Canvas page | **PASS** |
| S6 | Chat - Employee (managed sessions) | **PASS** |
| S7 | Chat - Repo redirect | **PASS** |
| S8 | Command Center | **PASS** |

**Overall: 8/8 PASS**

---

## Step 1: Agents List Page (`/agents`)

**Screenshot:** `01-agents-list.png`

### What was observed
- Page loads with search bar and status filters (全部, 运行中, 已停止, 异常, 已崩溃)
- Agents are grouped into three collapsible sections:
  1. **雇员 (Employees)** – count badge: 2 (mx-cc-employee-a1, mx-pi-employee-a2)
  2. **服务 (Services)** – count badge: 2 (mx-cc-service-a1, mx-pi-service-a2)
  3. **仓库 (Repositories)** – count badge: 12 (includes api-time-test, mx-cc-tool-a1, qa3-batch-0, etc.)
- Each section has a collapsible header with chevron icon, title, and count badge
- Tool archetype agents (e.g., mx-cc-tool-a1) appear under the Repositories section

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Grouped by archetype | Employees, Services, Repositories | 雇员, 服务, 仓库 | PASS |
| Collapsible headers | Yes | Yes (chevron, icon, title) | PASS |
| Count badges | Yes | Yes (2, 2, 12) | PASS |
| Tool under Repositories | Yes | mx-cc-tool-a1 in 仓库 | PASS |

### Issues
None.

---

## Step 2: Agent Detail - Employee type (`/agents/mx-pi-employee-a2`)

**Screenshot:** `02-agent-detail-employee.png`

### What was observed
- Agent name: mx-pi-employee-a2, status: 运行中 (Running)
- **Tabs:** 概览 (Overview), 会话 (Sessions), 画布 (Canvas), 日志 (Logs)
- **Buttons:** 对话 (Chat), 停止 (Stop), 销毁 (Destroy)
- Overview tab shows Name, Status, Archetype, Template, PID, Launch Mode, Workspace, Runtime

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Tabs: Overview, Sessions, Canvas, Logs | Yes | Yes | PASS |
| Start/Stop buttons | Yes | Stop visible (agent running) | PASS |
| Chat button | Yes | 对话 button present | PASS |

### Issues
None.

---

## Step 3: Agent Detail - Service type (`/agents/mx-pi-service-a2`)

**Screenshot:** `03-agent-detail-service.png`

### What was observed
- Agent name: mx-pi-service-a2, archetype badge: 服务 (Service)
- **Tabs:** 概览 (Overview), 会话 (Sessions), 日志 (Logs) — **no Canvas tab**
- **Buttons:** 对话 (Chat), 销毁 (Destroy) — **no Start/Stop**
- Overview shows Name, Status, Archetype, Template, PID, Launch Mode, Workspace, Runtime

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Tabs: Overview, Sessions, Logs (NO Canvas) | Yes | Yes | PASS |
| NO Start/Stop | Yes | None visible | PASS |
| Chat button | Yes | 对话 button present | PASS |

### Issues
None.

---

## Step 4: Agent Detail - Repo/Tool type (`/agents/qa3-test1`)

**Screenshot:** `04-agent-detail-repo.png`

### What was observed
- Agent name: qa3-test1, archetype badge: 仓库 (Repository)
- **Tabs:** Only 概览 (Overview)
- **Buttons:** Only 销毁 (Destroy) — no Chat, no Start/Stop
- Overview shows Name, Status, Archetype, Template, Workspace (no PID, no Runtime)

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Only Overview tab | Yes | Yes | PASS |
| NO Start/Stop or Chat | Yes | None visible | PASS |
| Destroy button only | Yes | 销毁 only | PASS |

### Issues
None.

---

## Step 5: Live Canvas Page (`/canvas`)

**Screenshot:** `05-live-canvas.png`

### What was observed
- Page title: 实时画布 (Live Canvas)
- Description: 由每个雇员智能体自主管理的实时流式工作区
- Section: 流式 AI 画布 with features (智能体专属区域, 安全沙箱, 实时更新)
- **智能体插槽 (Agent Slots):** Card for mx-pi-employee-a2 with "等待流连接..." (Waiting for stream connection)

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Live Canvas page | Yes | Yes | PASS |
| Employee agent slots | Yes | mx-pi-employee-a2 slot visible | PASS |

### Issues
None.

---

## Step 6: Chat Page - Employee managed sessions (`/agents/mx-pi-employee-a2/chat`)

**Screenshot:** `06-chat-employee-managed.png`

### What was observed
- Chat interface for mx-pi-employee-a2 (运行中)
- **Blue banner:** "会话由 Actant 托管，请选择已有会话进行对话。" (Sessions are managed by Actant. Please select an existing session to chat.)
- **No "New Chat" button** visible
- Input field and Send button present
- Empty chat state with prompt to start conversation

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| NO New Chat button | Yes | Not visible | PASS |
| Blue banner (managed by Actant) | Yes | 会话由 Actant 托管... | PASS |

### Issues
None.

---

## Step 7: Chat Page - Repo type redirect (`/agents/qa3-test1/chat`)

**Screenshot:** `07-chat-repo-unavailable.png`

### What was observed
- Centered message with folder icon
- **Message:** "仓库实例不支持对话。请使用IDE直接交互。" (Repository instances do not support chat. Please interact directly using the IDE.)
- 返回 (Back) button to navigate back

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Message: chat not available for repo | Yes | 仓库实例不支持对话... | PASS |
| Back button | Yes | 返回 present | PASS |

### Issues
None.

---

## Step 8: Command Center (`/`)

**Screenshot:** `08-command-center.png`

### What was observed
- Page title: 控制中心 (Command Center)
- Summary cards: 智能体总数 16, 运行中 2, 已停止 12, 异常 2
- Agent grid with 16 cards, each showing name, archetype tag (仓库/雇员/服务), status, template
- Examples: mx-pi-employee-a2 (运行中), mx-pi-service-a2, mx-cc-tool-a1 (仓库), qa3-test1 (仓库)

### Verification
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Command Center loads | Yes | Yes | PASS |
| Agent overview | Yes | Grid with status cards | PASS |

### Issues
None.

---

## Screenshots

| Step | File |
|------|------|
| 1 | `screenshots/01-agents-list.png` |
| 2 | `screenshots/02-agent-detail-employee.png` |
| 3 | `screenshots/03-agent-detail-service.png` |
| 4 | `screenshots/04-agent-detail-repo.png` |
| 5 | `screenshots/05-live-canvas.png` |
| 6 | `screenshots/06-chat-employee-managed.png` |
| 7 | `screenshots/07-chat-repo-unavailable.png` |
| 8 | `screenshots/08-command-center.png` |

---

## Notes

- Dashboard was tested in **Chinese (zh-CN)** locale.
- Automated script reported some WARNs due to English text matching; manual screenshot review confirms all steps **PASS**.
- Archetype grouping (Employees, Services, Repositories) and tool→repo mapping behave as specified.
