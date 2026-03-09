# Canvas Dual Mode QA Report

**Date:** 2025-02-27  
**Target:** http://localhost:3200  
**Feature:** Fixed-height on Live Canvas, auto-resize on Agent Detail Canvas tab

---

## Summary

| Step | Description | Result |
|------|-------------|--------|
| S1 | Live Canvas - Fixed Height Cards | **PASS** |
| S2 | Agent Detail Canvas Tab - Auto-Resize | **PASS** |
| S3 | Compare Heights | **PASS** |
| S4 | Scroll Inside Fixed Canvas | **PASS** |

**Overall: 4/4 PASS**

---

## Observed iframe Heights

| Location | iframe height | Mode |
|----------|---------------|------|
| Live Canvas page | **320px** | Fixed |
| Agent Detail Canvas tab | **1006px** | Auto-resize |
| Ratio (Detail / Live) | 3.14× | — |

---

## Step 1: Live Canvas Page - Fixed Height Cards (`/canvas`)

**Screenshot:** `01-live-canvas-fixed.png`

### Expected
- Fixed height ~320px
- Content overflows, scrollable inside iframe
- Card does NOT auto-resize
- Grid layout clean and consistent

### Observed
- **iframe height:** 320px (exact match to FIXED_HEIGHT constant)
- Content overflows: metric cards "CREATED" and "EMPLOYEES" partially cut off at bottom
- Card does not auto-resize; height remains fixed
- Grid layout consistent

### Result
**PASS**

---

## Step 2: Agent Detail Canvas Tab - Auto-Resize (`/agents/mx-pi-employee-a2`)

**Screenshot:** `02-agent-detail-autoresize.png`

### Expected
- iframe auto-resizes to show all content
- Height ~1000–1300px
- All 6 metric cards + full Agent Roster table visible
- No internal scrollbar

### Observed
- **iframe height:** 1006px
- All 6 metric cards visible: TOTAL, RUNNING, ERRORS, CREATED, EMPLOYEES, SERVICES
- Agent Roster table with multiple rows visible (mx-pi-employee-a2, mx-pi-service-a2, steward-a1, maintainer-a1, etc.)
- Content fully expanded, no internal scrollbar
- Height within expected 1000–1300px range

### Result
**PASS**

---

## Step 3: Compare Heights

### Expected
- Live Canvas: ~320px fixed
- Agent Detail: ~1000+ px auto-resized

### Observed
- **Live Canvas:** 320px
- **Agent Detail:** 1006px
- **Ratio:** 3.14× (Detail is ~3× taller)

### Result
**PASS**

---

## Step 4: Scroll Inside Fixed Canvas (`/canvas`)

**Screenshot:** `04-canvas-scrolled-inside.png`

### Expected
- Scroll within canvas card iframe to see table content
- Agent Roster table visible within fixed-height iframe after scroll
- iframe remains 320px

### Observed
- Scroll executed via `contentDocument.scrollTop = scrollHeight`
- iframe height remains 320px (fixed)
- Agent Roster content present in iframe (roster=True)
- Fixed-height behavior preserved

### Result
**PASS**

---

## Screenshots

| Step | File |
|------|------|
| 1 | `screenshots/01-live-canvas-fixed.png` |
| 2 | `screenshots/02-agent-detail-autoresize.png` |
| 4 | `screenshots/04-canvas-scrolled-inside.png` |

---

## Conclusion

The dual-mode canvas behavior works as intended:

1. **Live Canvas:** Fixed 320px height; content overflows and scrolls inside the iframe; grid layout stays consistent.
2. **Agent Detail Canvas tab:** Auto-resize to ~1006px; full content (6 cards + Agent Roster table) visible without internal scroll.
3. **Height comparison:** Live 320px vs Detail 1006px (≈3.14×).
4. **Scroll inside fixed iframe:** Scroll works; iframe stays at 320px.
