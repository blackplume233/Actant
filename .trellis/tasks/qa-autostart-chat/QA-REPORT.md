# Auto-Start on Chat QA Report

**Date:** 2025-02-27  
**Target:** http://localhost:3200  
**Feature:** Auto-start on chat for service-type agents

---

## Summary

| Step | Description | Result |
|------|-------------|--------|
| S1 | Service Chat - Not Running (steward-a1) | **PASS** |
| S2 | Service Chat - Type a Message | **PASS** |
| S3 | Service Chat - Running (mx-pi-service-a2) | **PASS** |
| S4 | Employee Chat - Not Running (maintainer-a1) | **PASS** |
| S5 | Service Chat - Error State (mx-cc-service-a1) | **PASS** |

**Overall: 5/5 PASS**

---

## Step 1: Service Chat - Not Running (steward-a1, status: created)

**Screenshot:** `01-service-chat-not-running.png`

### Expected
- Orange banner: "服务当前未运行，发送消息时将自动启动。"
- Text input ENABLED (not disabled)
- Empty state hint: "发送消息即可开始 — 服务将按需自动启动"
- Send button enabled when text is typed

### Observed
- **Orange banner:** "服务当前未运行，发送消息时将自动启动。" with lightning bolt icon
- **Text input:** Enabled, placeholder "向 steward-a1 发送消息..."
- **Empty state hint:** "发送消息即可开始 — 服务将按需自动启动。" (orange text)
- **Send button:** Present; enabled when input has text (verified in Step 2)

### Result
**PASS**

---

## Step 2: Service Chat - Type a Message

**Screenshot:** `02-service-chat-typed.png`

### Expected
- Input accepts text
- Send button becomes active/clickable when text is typed

### Observed
- "你好" typed in input field
- Send button (paper airplane icon) appears active/clickable (dark background)
- Input field enabled and accepts text

### Result
**PASS**

---

## Step 3: Service Chat - Running (mx-pi-service-a2, status: running)

**Screenshot:** `03-service-chat-running.png`

### Expected
- NO orange auto-start banner
- Input enabled
- "New Chat" button visible
- Ready hint: "智能体正在运行，可以开始对话"

### Observed
- **No orange banner:** Only normal chat UI
- **Input:** Enabled, placeholder "向 mx-pi-service-a2 发送消息..."
- **New Chat button:** "新对话" visible and enabled
- **Ready hint:** "智能体正在运行, 可以开始对话。"

### Result
**PASS**

---

## Step 4: Employee Chat - Not Running (maintainer-a1, status: created)

**Screenshot:** `04-employee-chat-not-running.png`

### Expected
- Blue "会话由 Actant 托管" banner (not orange)
- NO orange auto-start banner
- Input DISABLED
- Hint: "智能体已停止 — 请从详情页启动后再对话"

### Observed
- **Blue banner:** "会话由 Actant 托管, 请选择已有会话进行对话。"
- **No orange banner:** Correct
- **Input:** DISABLED (grayed out), placeholder "智能体未运行 — 请先启动"
- **Hint:** "智能体已停止 — 请从详情页启动后再对话。"
- **Send button:** Disabled

### Result
**PASS**

---

## Step 5: Service Chat - Error State (mx-cc-service-a1, status: error)

**Screenshot:** `05-service-chat-error.png`

### Expected
- Orange auto-start banner visible
- Input ENABLED

### Observed
- **Orange banner:** "服务当前未运行，发送消息时将自动启动。" with lightning bolt icon
- **Input:** Enabled, placeholder "向 mx-cc-service-a1 发送消息..."
- **Hint:** "发送消息即可开始 — 服务将按需自动启动。"
- Agent status: "异常" (Error)

### Result
**PASS**

---

## Screenshots

| Step | File |
|------|------|
| 1 | `screenshots/01-service-chat-not-running.png` |
| 2 | `screenshots/02-service-chat-typed.png` |
| 3 | `screenshots/03-service-chat-running.png` |
| 4 | `screenshots/04-employee-chat-not-running.png` |
| 5 | `screenshots/05-service-chat-error.png` |

---

## Conclusion

The auto-start on chat feature behaves as intended:

- **Service (created/error):** Orange banner, input enabled, "发送消息即可开始 — 服务将按需自动启动" hint
- **Service (running):** No orange banner, input enabled, New Chat button, normal running hint
- **Employee (created):** Blue managed-sessions banner, input disabled, "请从详情页启动" hint

Service agents allow typing and sending when not running; employees remain blocked until started from the detail page.
