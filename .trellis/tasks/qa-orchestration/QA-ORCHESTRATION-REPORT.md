# Orchestration Feature QA Report

**Base URL:** http://localhost:3200 (5199 returned blank; tested 3200)
**User-specified URL:** http://localhost:5199 (returned blank screens; tested 3200)

## Summary

- **PASS:** 0
- **WARN:** 3
- **FAIL:** 4

## Results

### T1: Sidebar: Orchestration

- **Status:** WARN
- **Detail:** sidebar_text=A
Actant
控制台
实时画布
智能体
活动
事件
设置
English
中文

v0.2.3

12 个智能体

### T2: Orchestration list

- **Status:** FAIL
- **Detail:** title=False, create=False, search=False

### T3: Create wizard

- **Status:** FAIL
- **Detail:** title=False, archetype=False, next_disabled=False

### T4: Employee selection

- **Status:** WARN
- **Detail:** scheduler=False, next_enabled=False

### T5: Basic Info form

- **Status:** FAIL
- **Detail:** name=False, desc=False

### T6: Skills step

- **Status:** FAIL
- **Detail:** available=False, selected=False

### T7: Final navigation

- **Status:** WARN
- **Detail:** body_preview=A
Actant
控制台
实时画布
智能体
活动
事件
设置
English
中文

v0.2.3

12 个智能体

Actant
v0.2.3
|
4h 25m
在线

404

页面未找到

返回控制台

---

## Structured Findings (per user test plan)

| Step | Test | Judgment | Notes |
|------|------|----------|-------|
| 1 | Sidebar: Orchestration link between Agents and Activity, Workflow icon | WARN | Link "编排" missing from sidebar |
| 2 | Orchestration list: title, Create Template, search, filters, view toggle, empty state | FAIL | 404 page |
| 3 | Create wizard: back, title, steps, archetype cards, disabled Next | FAIL | 404 page |
| 4 | Employee selection: card highlight, Next enabled, Scheduler step | WARN | Blocked |
| 5 | Basic Info: Name, Backend, Description, Layer, Version, Prompt, Edit/Preview | FAIL | Blocked |
| 6 | Skills: Available/Selected panels, search | FAIL | Blocked |
| 7 | Navigate to /orchestration renders correctly | WARN | 404 |

**Root cause:** Orchestration feature exists in source but not in deployed build. Rebuild recommended.

**Screenshots:** 01-sidebar-home.png through 07-orchestration-final.png in screenshots/

