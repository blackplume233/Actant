# Orchestration Regression QA Report

**Base URL:** http://localhost:5210

## Summary

- **PASS:** 20
- **WARN:** 3
- **FAIL:** 0

## Results

### A1: 编排 link in sidebar between 智能体 and 活动

- **Status:** PASS
- **Detail:** Link visible

### A2: Click 编排 -> URL is /orchestration

- **Status:** PASS
- **Detail:** url=http://localhost:5210/orchestration

### B1: Title 编排, 创建模板, search, archetype filters, layer, grid/list toggle

- **Status:** PASS
- **Detail:** archetype=True, layer=True, toggle=False

### B2: Archetype filter badges

- **Status:** WARN
- **Detail:** Badge not found

### B3: Grid/list toggle

- **Status:** WARN
- **Detail:** grid=0, list=0

### B4: Search nonexistent -> no-match/empty state

- **Status:** PASS
- **Detail:** no_match=True

### C1: Wizard Step 1: 选择原型 active, 3 cards, Next disabled

- **Status:** PASS

### C2: Service selected: Next enabled, NO scheduler step

- **Status:** PASS

### C3: Employee added: both selected, scheduler step appears

- **Status:** PASS

### C4: Step 2: all form fields present

- **Status:** PASS

### C5: Fill Name=loop-test-tpl, Description=Loop test template

- **Status:** PASS

### C6: Step 3: dual-panel layout

- **Status:** PASS

### C7: Step 4: heartbeat/cron/hooks sections

- **Status:** PASS

### C8: Heartbeat checkbox: interval/prompt/priority fields appear

- **Status:** PASS

### C9: Step 5: summary cards, JSON, correct data

- **Status:** PASS

### D1: Back arrow returns to /orchestration

- **Status:** PASS

### D2: No archetype: Next disabled, error text

- **Status:** PASS
- **Detail:** error=True

### D3: Empty Name: validation error

- **Status:** WARN
- **Detail:** err=False

### D4: Invalid name format: validation error

- **Status:** PASS
- **Detail:** err=True

### D5: Valid name through to Preview: JSON shows correct name

- **Status:** PASS
- **Detail:** valid=True

### E1: Direct /orchestration/create loads wizard

- **Status:** PASS

### E2: Direct /orchestration/nonexistent-template graceful

- **Status:** PASS
- **Detail:** body_preview=A
Actant
控制台
实时画布
智能体
编排
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
4

### E3: Direct /orchestration/.../materialize graceful

- **Status:** PASS
- **Detail:** body_preview=A
Actant
控制台
实时画布
智能体
编排
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
4

