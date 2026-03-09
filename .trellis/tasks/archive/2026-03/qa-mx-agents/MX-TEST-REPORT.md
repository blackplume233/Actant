# Actant Dashboard — mx-* Agents Comprehensive Test Report

**Test Date**: 2026-02-27  
**Application**: http://localhost:3200  
**Test Matrix**: 7 agents (tool/employee/service × claude-code/cursor/pi)

---

## Executive Summary

| Phase | Result | Notes |
|-------|--------|-------|
| Phase 1: Overview | **PASS** | All 7 mx-* agents visible, archetypes correct |
| Phase 2: Agent Details | **PARTIAL** | All agents load; no archetype-specific tabs |
| Phase 3: Interactive Actions | **PASS** | Stop/Start/Chat work correctly |
| Phase 4: Navigation & UI | **PASS** | Sidebar, Settings, Events, responsive OK |

**Overall**: 21 PASS, 1 WARN, 0 FAIL. Core functionality works; several archetype-specific features are missing.

---

## Phase 1: Overview Page (http://localhost:3200/)

### 1.1 Test Results

| Check | Result | Detail |
|-------|--------|--------|
| All 7 mx-* agents visible | PASS | mx-cc-tool-a1, mx-cc-employee-a1, mx-cc-service-a1, mx-cursor-tool-a1, mx-pi-tool-a1, mx-pi-employee-a1, mx-pi-service-a1 |
| Archetype labels | PASS | tool (purple), employee (blue), service (orange) badges |
| Backend type shown | PASS | Via template name (mx-cc-*, mx-cursor-*, mx-pi-*) |
| Status correct | PASS | running (6), created (1 for mx-cursor-tool-a1) |
| Filter/grouping by archetype | WARN | No filtering on overview; grid only |

### 1.2 Screenshot: `p1-overview.png`

- Command Center with stats: 16 total, 6 running, 10 stopped, 0 error
- Agent grid with all mx-* agents
- Archetype badges: tool (purple), employee (blue), service (orange)
- Template names: mx-cc-tool, mx-cc-employee, mx-cc-service, mx-cursor-tool, mx-pi-tool, mx-pi-employee, mx-pi-service
- Launch mode: direct (tool) or acp-service (employee/service)

### 1.3 UI Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **B1** | Minor | mx-pi-* and mx-cursor-tool-a1 cards on overview: Some agents don't show PID/uptime on their cards (mx-cc-* do). Inconsistent display. |
| **B2** | Minor | No archetype filter or grouping on overview page |

---

## Phase 2: Agent Detail Pages — Per-Agent

### 2.1 Tabs Available (All Archetypes)

**Current implementation**: All agents have the same 3 tabs:

| Tab | Route | Description |
|-----|-------|-------------|
| Overview | In-page | Name, Status, Archetype, Template, PID, LaunchMode, Workspace, Uptime |
| Sessions | In-page | Session list, conversation history |
| Logs | In-page | Agent log output |
| Chat | `/agents/:name/chat` | Separate route, not a tab |

**Expected but missing** (per archetype):

- Employee: Tasks, Schedule, Canvas
- Service: No extra tabs beyond generic Sessions
- Tool: Same as current

### 2.2 Tool Agents

| Agent | Status | Tabs | Overview | Notes |
|-------|--------|------|----------|-------|
| mx-cc-tool-a1 | running | Overview, Sessions, Logs | All fields | PASS |
| mx-cursor-tool-a1 | created | Overview, Sessions, Logs | All fields | Start button, no Stop — correct |
| mx-pi-tool-a1 | running | Overview, Sessions, Logs | All fields | PASS |

**Screenshots**: `p2-detail-mx-cc-tool-a1.png`, `p2-detail-mx-cursor-tool-a1.png`, `p2-detail-mx-pi-tool-a1.png`

**mx-cursor-tool-a1 (created)**:
- Status: "已创建" (Created)
- Buttons: Start, Chat, Destroy
- No Stop button
- PID and Uptime: `—`

### 2.3 Employee Agents

| Agent | Status | Tabs | Archetype | Notes |
|-------|--------|------|-----------|-------|
| mx-cc-employee-a1 | running | Overview, Sessions, Logs | employee | PASS |
| mx-pi-employee-a1 | running | Overview, Sessions, Logs | employee | PASS |

**Screenshots**: `p2-detail-mx-cc-employee-a1.png`, `p2-detail-mx-pi-employee-a1.png`

**Missing features**:

- Tasks tab
- Schedule tab / heartbeat (intervalMs: 300000 for cc, 600000 for pi)
- Canvas tab
- Dispatch UI

**Note**: Live Canvas (`/canvas`) is a separate page for employee agents, not a tab in agent detail.

### 2.4 Service Agents

| Agent | Status | Tabs | Archetype | Notes |
|-------|--------|------|-----------|-------|
| mx-cc-service-a1 | running | Overview, Sessions, Logs | service | PASS |
| mx-pi-service-a1 | running | Overview, Sessions, Logs | service | PASS |

**Screenshots**: `p2-detail-mx-cc-service-a1.png`, `p2-detail-mx-pi-service-a1.png`

**Observation**: Same UI as tool agents. Sessions tab is generic; no multi-session-specific UI.

### 2.5 Chat Tab

- Chat is at `/agents/:name/chat` (separate route)
- Input, send button, agent name, status, New Chat visible
- Tested with mx-cc-employee-a1 — message sent and agent responded

---

## Phase 3: Interactive Actions

### 3.1 Stop Agent (mx-pi-tool-a1)

| Step | Result |
|------|--------|
| Click Stop | PASS |
| Status changed to "已停止" | PASS |
| Screenshot `p3-after-stop.png` | Status: stopped, Start button visible |

### 3.2 Start Agent

| Step | Result |
|------|--------|
| Click Start | PASS |
| Agent restarted | PASS |

### 3.3 Chat (mx-cc-employee-a1)

| Step | Result |
|------|--------|
| Type "Hello, test message" | PASS |
| Send | PASS |
| Agent response | PASS — agent replied in Chinese |

**Screenshot**: `p3-chat-sent.png` — user message and agent reply visible

### 3.4 SSE / Real-Time Updates

- Status changed after stop without manual refresh
- Indicates SSE/real-time updates working

---

## Phase 4: Navigation and UI Quality

| Check | Result |
|-------|--------|
| Sidebar | PASS — all nav links reachable |
| Settings | PASS — connection status, daemon info |
| Events | PASS — event log visible |
| Back/forward | PASS — navigation works |
| Responsive (375px) | PASS — content visible |

**Screenshots**: `p4-settings.png`, `p4-events.png`, `p4-responsive.png`

---

## 5. Bugs Found

| ID | Severity | Description |
|----|----------|-------------|
| **B1** | Minor | Overview cards: mx-pi-* and mx-cursor-tool-a1 cards sometimes omit PID/uptime; mx-cc-* show it. Inconsistent display. |
| **B2** | Minor | Overview: no archetype filter or grouping on Command Center. |
| **B3** | Feature | Employee agents: no Tasks, Schedule, Canvas tabs in agent detail. |
| **B4** | Feature | Employee agents: no schedule/heartbeat (intervalMs) display. |
| **B5** | Feature | Employee agents: no dispatch UI. |
| **B6** | Feature | Service agents: no UI for multi-session beyond generic Sessions tab. |

---

## 6. Archetype-Specific Behavior

### 6.1 Current Behavior

| Archetype | Tabs | Special UI |
|-----------|------|------------|
| **Tool** | Overview, Sessions, Logs | None |
| **Employee** | Overview, Sessions, Logs | None in detail; Live Canvas page for employee agents |
| **Service** | Overview, Sessions, Logs | None |

### 6.2 Expected vs Actual

| Feature | Expected | Actual |
|---------|----------|--------|
| Employee: Tasks tab | Yes | No |
| Employee: Schedule tab | Yes | No |
| Employee: Canvas tab | Yes | No |
| Employee: Schedule/heartbeat | Yes | No |
| Employee: Dispatch | Yes | No |
| Service: Multi-session UI | Yes | No (generic Sessions) |
| Tool: Same as others | Yes | Yes |

---

## 7. Page Ratings

| Page | Rating | Notes |
|------|--------|-------|
| Command Center (Overview) | **PASS** | All 7 mx-* agents visible, archetypes correct |
| Agent Detail (Tool) | **PASS** | All 3 tabs, metadata, correct Start/Stop/created |
| Agent Detail (Employee) | **PARTIAL** | Same as tool; no Tasks/Schedule/Canvas |
| Agent Detail (Service) | **PARTIAL** | Same as tool; no multi-session UI |
| Agent Chat | **PASS** | Input, send, history, agent response |
| Live Canvas | **PASS** | Employee-only page (separate) |
| Settings | **PASS** | Connection, daemon info |
| Events | **PASS** | Event log |
| Responsive | **PASS** | 375px layout OK |

---

## 8. Screenshot Index

| File | Description |
|------|-------------|
| `p1-overview.png` | Command Center with all mx-* agents |
| `p2-detail-mx-cc-tool-a1.png` | Tool agent (claude-code) |
| `p2-detail-mx-cc-employee-a1.png` | Employee agent (claude-code) |
| `p2-detail-mx-cc-service-a1.png` | Service agent (claude-code) |
| `p2-detail-mx-cursor-tool-a1.png` | Tool agent (cursor, created) |
| `p2-detail-mx-pi-tool-a1.png` | Tool agent (pi) |
| `p2-detail-mx-pi-employee-a1.png` | Employee agent (pi) |
| `p2-detail-mx-pi-service-a1.png` | Service agent (pi) |
| `p3-after-stop.png` | mx-pi-tool-a1 after stop |
| `p3-chat-sent.png` | Chat with mx-cc-employee-a1 |
| `p4-settings.png` | Settings page |
| `p4-events.png` | Events page |
| `p4-responsive.png` | 375px viewport |

---

## 9. Recommendations

1. **B1**: Add PID/uptime to all agent cards consistently.
2. **B2**: Add archetype filter on overview (e.g. All / Tool / Employee / Service).
3. **B3–B5**: Add archetype-specific tabs for employee:
   - Tasks
   - Schedule (with heartbeat/intervalMs)
   - Canvas (or link to Live Canvas)
   - Dispatch UI
4. **B6**: Add service-specific UI for multi-session handling.
