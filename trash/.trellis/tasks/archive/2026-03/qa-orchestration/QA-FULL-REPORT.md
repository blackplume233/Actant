# Orchestration QA Full Report

**Base URL:** http://localhost:5200

## Summary

- **PASS:** 9
- **WARN:** 0
- **FAIL:** 0

## Results

### T1: Sidebar: Orchestration link between Agents and Activity, Workflow icon

- **Status:** PASS
- **Detail:** Link visible

### T2: Orchestration list: URL, title, Create Template, filters, search, view toggle

- **Status:** PASS
- **Detail:** search=True, filters=True, view=False

### T3: Create wizard Step 1: back, title, steps, 3 archetype cards, nav buttons

- **Status:** PASS
- **Detail:** next_disabled=True

### T4: Employee selected: card highlight, Next enabled, Scheduler step

- **Status:** PASS
- **Detail:** scheduler=True, next_enabled=True

### T5: Basic Info: Name, Backend, Description, Layer, Version, Prompt, Edit/Preview

- **Status:** PASS
- **Detail:** all_fields=True,True,True,True,True,True

### T6: Skills step: Available Skills, Selected Skills, search bar

- **Status:** PASS
- **Detail:** search=True

### T7a: Scheduler: Heartbeat, Cron Jobs, Event Hooks

- **Status:** PASS
- **Detail:** heartbeat=True, cron=True, hooks=True

### T7b: Preview: Summary cards, JSON Preview, Create button

- **Status:** PASS
- **Detail:** json=True, create_btn=True

### T8: Return to /orchestration list renders correctly

- **Status:** PASS
- **Detail:** Page loads

