# Hub Presets QA Report

**Date:** 2025-02-27  
**Target:** http://localhost:3200  
**Environment:** 12 agents from actant-hub preset templates (cleaned up)

---

## Summary

| Step | Description | Result |
|------|-------------|--------|
| S1 | Agents List - Hub Preset Grouping | **PASS** |
| S2 | Steward (Service) Detail | **PASS** |
| S3 | Maintainer (Employee) Detail | **PASS** |
| S4 | Onboarder (Repo/Tool) Detail | **PASS** |
| S5 | Researcher (Service) Chat | **PASS** |
| S6 | Curator (Employee) Chat | **PASS** |
| S7 | Onboarder (Repo) Chat | **PASS** |
| S8 | Live Canvas with Hub Employees | **PASS** |
| S9 | Settings Page | **PASS** |

**Overall: 9/9 PASS**

---

## Step 1: Agents List - Verify Grouping with Hub Presets (`/agents`)

**Screenshot:** `01-agents-list-hub.png`

### Expected
- **雇员 (Employees) 5:** mx-cc-employee-a1, mx-pi-employee-a2, maintainer-a1, scavenger-a1, curator-a1
- **服务 (Services) 4:** mx-cc-service-a1, mx-pi-service-a2, steward-a1, researcher-a1
- **仓库 (Repositories) 3:** mx-cc-tool-a2, reg-cursor-test, onboarder-a1
- Correct status badges and archetype icons

### Observed
- **雇员 5:** mx-cc-employee-a1 (异常), mx-pi-employee-a2 (运行中), maintainer-a1 (已创建), scavenger-a1 (已创建), curator-a1 (已创建)
- **服务 4:** mx-cc-service-a1, mx-pi-service-a2, steward-a1, researcher-a1
- **仓库 3:** mx-cc-tool-a2, reg-cursor-test, onboarder-a1
- Each card shows archetype badge and status (where applicable)
- Template names visible (e.g., actant-hub@actant-maintainer, actant-hub@actant-steward)

### Result
**PASS**

---

## Step 2: Hub Preset - Steward (Service) Detail (`/agents/steward-a1`)

**Screenshot:** `02-steward-detail.png`

### Expected
- Template: actant-hub@actant-steward
- Status: created
- tabs: 概览, 会话, 日志 (no 画布)
- NO Start/Stop
- Chat button visible

### Observed
- Template: actant-hub@actant-steward
- Status: created
- Tabs: 概览, 会话, 日志 (no Canvas tab)
- Buttons: 对话 (Chat), 销毁 (Destroy) — no Start/Stop
- Overview shows Name, Status, Archetype, Template, PID, Launch Mode, Workspace, Runtime

### Result
**PASS**

---

## Step 3: Hub Preset - Maintainer (Employee) Detail (`/agents/maintainer-a1`)

**Screenshot:** `03-maintainer-detail.png`

### Expected
- Template: actant-hub@actant-maintainer
- Archetype employee → tabs: 概览, 会话, 画布, 日志
- Start/Stop buttons
- Chat button

### Observed
- Template: actant-hub@actant-maintainer
- Status: 已创建 (created)
- Tabs: 概览, 会话, 画布, 日志
- Buttons: 对话 (Chat), 启动 (Start), 销毁 (Destroy)

### Result
**PASS**

---

## Step 4: Hub Preset - Onboarder (Repo/Tool) Detail (`/agents/onboarder-a1`)

**Screenshot:** `04-onboarder-detail.png`

### Expected
- Template: actant-hub@actant-onboarder
- Archetype tool (maps to repo) → only 概览 tab
- NO Chat, NO Start/Stop
- Only Destroy button

### Observed
- Template: actant-hub@actant-onboarder
- Archetype badge: 仓库 (Repository)
- Only 概览 (Overview) tab
- Only 销毁 (Destroy) button — no Chat, no Start/Stop

### Result
**PASS**

---

## Step 5: Hub Preset - Researcher (Service) Chat (`/agents/researcher-a1/chat`)

**Screenshot:** `05-researcher-chat.png`

### Expected
- Service type → chat available
- "New Chat" button visible (services CAN create sessions)
- No managed-sessions banner

### Observed
- Chat interface for researcher-a1
- 新对话 (New Chat) button visible
- No blue "会话由 Actant 托管" banner
- Input area present (disabled when agent not running)

### Result
**PASS**

---

## Step 6: Hub Preset - Curator (Employee) Chat (`/agents/curator-a1/chat`)

**Screenshot:** `06-curator-chat.png`

### Expected
- Employee type → chat available but managed
- No "New Chat" button
- Blue banner: "会话由 Actant 托管"

### Observed
- Blue banner: "会话由 Actant 托管, 请选择已有会话进行对话。" (Sessions are managed by Actant, please select an existing session to chat)
- No "New Chat" button
- Chat input present (disabled when agent not running)

### Result
**PASS**

---

## Step 7: Hub Preset - Onboarder (Repo) Chat (`/agents/onboarder-a1/chat`)

**Screenshot:** `07-onboarder-chat-unavailable.png`

### Expected
- Repo/tool type → chat NOT available
- Message: "仓库实例不支持对话" with back button

### Observed
- Message: "仓库实例不支持对话。请使用 IDE 直接交互。" (Repository instances do not support conversations. Please interact directly using the IDE.)
- 返回 (Back) button present
- Folder icon indicating repository type

### Result
**PASS**

---

## Step 8: Live Canvas with Hub Employees (`/canvas`)

**Screenshot:** `08-live-canvas-hub.png`

### Expected
- Slots only for running employees
- maintainer-a1, scavenger-a1, curator-a1 (created) → NO slots
- mx-pi-employee-a2 (running) → slot with "Agent Metrics Dashboard" canvas

### Observed
- Single agent slot: mx-pi-employee-a2
- Badge: "Agent Metrics Dashboard"
- Dark-themed "Actant Agent Metrics" dashboard with metric cards (16, 2, 2)
- No slots for maintainer-a1, scavenger-a1, curator-a1 (created agents not shown)

### Result
**PASS**

---

## Step 9: Settings Page (`/settings`)

**Screenshot:** `09-settings.png`

### Expected
- Settings page loads correctly

### Observed
- 设置 (Settings) page with subtitle "守护进程信息和控制台配置"
- 守护进程连接: 已连接 (Connected)
- 守护进程信息: Version 0.2.3, Runtime 16m, 托管智能体 12
- 智能体概览: Error 2, Stopped 2, Running 2, Created 6
- 关于: Actant 控制台, WebTransport (HTTP + SSE), Tauri ready architecture

### Result
**PASS**

---

## Screenshots

| Step | File |
|------|------|
| 1 | `screenshots/01-agents-list-hub.png` |
| 2 | `screenshots/02-steward-detail.png` |
| 3 | `screenshots/03-maintainer-detail.png` |
| 4 | `screenshots/04-onboarder-detail.png` |
| 5 | `screenshots/05-researcher-chat.png` |
| 6 | `screenshots/06-curator-chat.png` |
| 7 | `screenshots/07-onboarder-chat-unavailable.png` |
| 8 | `screenshots/08-live-canvas-hub.png` |
| 9 | `screenshots/09-settings.png` |

---

## Conclusion

All 9 steps passed. The dashboard correctly handles the 12 actant-hub preset agents:

- **Archetype grouping:** Employees (5), Services (4), Repositories (3)
- **Service archetype:** tabs 概览/会话/日志, no Canvas, no Start/Stop, Chat available
- **Employee archetype:** tabs 概览/会话/画布/日志, Start/Stop, Chat (managed)
- **Repo/tool archetype:** only Overview tab, Destroy only, no Chat
- **Chat restrictions:** Service → New Chat; Employee → managed banner; Repo → not available
- **Live Canvas:** only running employees get slots
- **Settings:** loads with daemon info and agent overview
