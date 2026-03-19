# Orchestration Feature QA Report

**Test URL:** http://localhost:5199/ (user-specified)
**Fallback URL tested:** http://localhost:3200/ (dashboard default port)
**Date:** 2026-02-27

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **PASS** | 0 |
| **WARN** | 3 |
| **FAIL** | 4 |

**Critical finding:** The Orchestration feature is **not accessible** in the deployed dashboard. The sidebar does not show the "Orchestration" / "编排" link, and direct navigation to `/orchestration` returns a 404 page.

---

## Test Results by Step

### Test 1: Sidebar Navigation — **WARN**

**Steps:** Navigate to http://localhost:5199/ → Take full-page screenshot → Look for "Orchestration" (or "编排") between "Agents" and "Activity" → Verify Workflow icon.

- **Page loads:** Home page loads on 3200; blank white screen on 5199
- **"Orchestration" / "编排" in sidebar:** MISSING
- **Workflow icon:** Not visible (link absent)
- **Sidebar order observed:** 控制台 → 实时画布 → 智能体 → 活动 → 事件 → 设置

**Judgment:** WARN — Sidebar structure present but Orchestration link missing.

---

### Test 2: Orchestration List Page — **FAIL**

**Steps:** Click "Orchestration" sidebar link → Navigate to /orchestration.

- **Navigate to /orchestration:** 404 (no sidebar link; direct URL returns 404)
- **Page title, Create Template, search, filters, view toggle, empty state:** All absent

**Judgment:** FAIL — Page inaccessible.

---

### Test 3: Template Create Wizard — **FAIL**

**Steps:** Click "Create Template" → Navigate to /orchestration/create.

- **All expected elements:** Absent (404 page)

**Judgment:** FAIL — Create wizard inaccessible.

---

### Test 4: Wizard Step 1 Interaction — **WARN**

**Steps:** Click "Employee" archetype card → Verify selected state, Next enabled, Scheduler step.

- **Result:** Cannot test; wizard not reached.

**Judgment:** WARN — Blocked by previous failures.

---

### Test 5: Wizard Step 2 - Basic Info — **FAIL**

**Steps:** Click Next → Step 2 → Verify form fields.

- **Result:** Basic Info step inaccessible.

**Judgment:** FAIL — Blocked.

---

### Test 6: Wizard Step 3 - Skills — **FAIL**

**Steps:** Fill Name/Description → Next → Verify Available/Selected Skills panels.

- **Result:** Skills step inaccessible.

**Judgment:** FAIL — Blocked.

---

### Test 7: Navigation and Responsiveness — **WARN**

**Steps:** Navigate to /orchestration → Final screenshot.

- **Result:** 404 on both 5199 and 3200.

**Judgment:** WARN — Route returns 404.

---

## Root Cause

1. **Port 5199:** Blank white screens; may be a different service or misconfiguration.
2. **Port 3200:** Dashboard loads but Orchestration link is missing from sidebar and /orchestration returns 404. Source code includes the feature; **deployed build is likely outdated**.

---

## Recommendations

1. Rebuild dashboard: `pnpm --filter @actant/dashboard build` and restart.
2. Confirm correct port (3200 default).
3. Ensure SPA fallback serves index.html for /orchestration paths.

---

## Screenshots

- 01-sidebar-home.png — Home page; sidebar without Orchestration
- 02–07 — All show 404 page
