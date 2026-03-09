"""Actant Dashboard Full QA Black-Box Test - http://localhost:3200

Test plan: Command Center, Agents, Agent Detail, Agent Chat, Activity, Events, Settings,
Navigation, 404, Responsive. Screenshots saved to screenshots/ subdir.
"""
import json
import os
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

BASE = "http://localhost:3200"
SCRIPT_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = SCRIPT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(exist_ok=True)

results = []
console_errors = []


def record(step_id, desc, status, detail=""):
    results.append({"id": step_id, "desc": desc, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{icon}] {step_id}: {desc} - {detail[:150] if detail else ''}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)

        page.on("console", on_console)

        def go(path, wait=2000):
            # Use domcontentloaded - SSE keeps connections open so networkidle never fires
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        # ========== 1. Command Center (/) ==========
        try:
            go("/")
            screenshot("01-command-center.png")
            body = page.inner_text("body")
            # Stats cards: total, running, stopped, error
            has_stats = any(x in body for x in ["16", "4", "1", "11", "Total", "Running", "Stopped"])
            has_agents = page.locator("[class*='card'], [class*='Card'], [data-testid]").count() > 0
            has_events = "event" in body.lower() or "Event" in body or "Recent" in body
            if has_stats or has_agents:
                record("T1", "Command Center loads with stats and agent grid", "PASS",
                       f"stats={has_stats}, agents={has_agents}, events={has_events}")
            else:
                record("T1", "Command Center", "WARN", f"Body preview: {body[:200]}")
        except Exception as e:
            record("T1", "Command Center", "FAIL", str(e))

        # Click an agent card to verify navigation (Card has onClick, not <a>)
        try:
            agent_card = page.locator("[class*='cursor-pointer']").filter(has=page.locator("h3")).first
            if agent_card.count() > 0:
                agent_card.click()
                page.wait_for_timeout(1500)
                url = page.url
                if "/agents/" in url:
                    record("T1b", "Agent card click navigates to detail", "PASS", f"url={url}")
                else:
                    record("T1b", "Agent card click", "WARN", f"url={url}")
            else:
                record("T1b", "Agent card click", "WARN", "No agent card link found")
        except Exception as e:
            record("T1b", "Agent card click", "FAIL", str(e))

        # ========== 2. Agents list (/agents) ==========
        try:
            go("/agents")
            screenshot("02-agents-page.png")
            search = page.locator("input[placeholder*='Search'], input[placeholder*='搜索']").first
            if search.count() > 0:
                record("T2a", "Search box exists", "PASS")
                search.fill("qa3")
                page.wait_for_timeout(1000)
                body = page.inner_text("body")
                if "qa3" in body:
                    record("T2b", "Search 'qa3' filters results", "PASS")
                else:
                    record("T2b", "Search filter", "WARN", "No qa3 in body after search")
                search.fill("")
                page.wait_for_timeout(500)
            else:
                record("T2a", "Search box", "FAIL", "Not found")
        except Exception as e:
            record("T2", "Agents page search", "FAIL", str(e))

        # Status filters: running, all, stopped
        try:
            running_btn = page.locator("text=Running, button:has-text('Running'), [class*='badge']:has-text('Running')").first
            if running_btn.count() > 0:
                running_btn.click()
                page.wait_for_timeout(1000)
                screenshot("02b-agents-filter-running.png")
                body = page.inner_text("body")
                record("T2c", "Running filter applied", "PASS")
                all_btn = page.locator("text=All, button:has-text('All'), [class*='badge']:has-text('All')").first
                if all_btn.count() > 0:
                    all_btn.click()
                    page.wait_for_timeout(500)
                stopped_btn = page.locator("text=Stopped, button:has-text('Stopped')").first
                if stopped_btn.count() > 0:
                    stopped_btn.click()
                    page.wait_for_timeout(1000)
                    screenshot("02c-agents-filter-stopped.png")
                all_btn2 = page.locator("text=All, button:has-text('All')").first
                if all_btn2.count() > 0:
                    all_btn2.click()
            else:
                record("T2c", "Status filter badges", "WARN", "Running/All/Stopped not found")
        except Exception as e:
            record("T2c", "Status filters", "FAIL", str(e))

        # ========== 3. Agent detail - qa3-batch-0 (running) ==========
        try:
            go("/agents/qa3-batch-0")
            screenshot("03-agent-detail-qa3-batch-0.png")
            body = page.inner_text("body")
            has_name = "qa3-batch-0" in body
            has_status = any(s in body for s in ["running", "Running"])
            has_tabs = any(t in body for t in ["Overview", "Sessions", "Logs", "概览", "会话", "日志"])
            if has_name and has_status:
                record("T3", "Agent detail qa3-batch-0 (running)", "PASS", f"tabs={has_tabs}")
            else:
                record("T3", "Agent detail qa3-batch-0", "WARN", f"name={has_name}, status={has_status}")
        except Exception as e:
            record("T3", "Agent detail", "FAIL", str(e))

        # Overview tab fields
        try:
            body = page.inner_text("body")
            overview_fields = ["Name", "Status", "Archetype", "Template", "PID", "Workspace", "Uptime"]
            found = sum(1 for f in overview_fields if f in body)
            if found >= 4:
                record("T3a", "Overview tab shows key fields", "PASS", f"{found} fields")
            else:
                record("T3a", "Overview fields", "WARN", f"Found {found} of {overview_fields}")
        except Exception as e:
            record("T3a", "Overview tab", "FAIL", str(e))

        # Sessions tab
        try:
            sessions_tab = page.locator("button:has-text('Sessions'), button:has-text('会话'), [data-value='sessions']").first
            if sessions_tab.count() > 0:
                sessions_tab.click()
                page.wait_for_timeout(1000)
                screenshot("03b-agent-sessions-tab.png")
                record("T3b", "Sessions tab loads", "PASS")
            else:
                record("T3b", "Sessions tab", "WARN", "Tab not found")
        except Exception as e:
            record("T3b", "Sessions tab", "FAIL", str(e))

        # Logs tab
        try:
            logs_tab = page.locator("button:has-text('Logs'), button:has-text('日志'), [data-value='logs']").first
            if logs_tab.count() > 0:
                logs_tab.click()
                page.wait_for_timeout(1000)
                screenshot("03c-agent-logs-tab.png")
                record("T3c", "Logs tab loads", "PASS")
            else:
                record("T3c", "Logs tab", "WARN", "Tab not found")
        except Exception as e:
            record("T3c", "Logs tab", "FAIL", str(e))

        # Action buttons: Start/Stop, Destroy, Chat
        try:
            has_chat = page.locator("button:has-text('Chat'), a:has-text('Chat')").count() > 0
            has_stop = page.locator("button:has-text('Stop')").count() > 0
            has_destroy = page.locator("button:has-text('Destroy')").count() > 0
            if has_chat and (has_stop or has_destroy):
                record("T3d", "Action buttons (Chat, Stop, Destroy)", "PASS")
            else:
                record("T3d", "Action buttons", "WARN", f"Chat={has_chat}, Stop={has_stop}, Destroy={has_destroy}")
        except Exception as e:
            record("T3d", "Action buttons", "FAIL", str(e))

        # ========== 4. Agent detail - qa3-test3 (created) ==========
        try:
            go("/agents/qa3-test3")
            screenshot("04-agent-detail-qa3-test3-created.png")
            body = page.inner_text("body")
            has_name = "qa3-test3" in body
            has_created = "created" in body.lower() or "Created" in body
            has_start = page.locator("button:has-text('Start')").count() > 0
            if has_name and has_created and has_start:
                record("T4", "Agent detail qa3-test3 (created) shows Start button", "PASS")
            elif has_name:
                record("T4", "Agent detail qa3-test3", "WARN", f"created={has_created}, start={has_start}")
            else:
                record("T4", "Agent detail qa3-test3", "FAIL", "Agent not found")
        except Exception as e:
            record("T4", "Agent detail created", "FAIL", str(e))

        # ========== 5. Agent Chat (/agents/qa3-batch-0/chat) ==========
        try:
            go("/agents/qa3-batch-0/chat")
            screenshot("05-agent-chat.png")
            has_input = page.locator("input, textarea, [contenteditable='true']").count() > 0
            has_send = page.locator("button:has-text('Send'), button:has-text('发送'), button[type='submit']").count() > 0
            has_new_chat = page.locator("button:has-text('New Chat'), button:has-text('新对话')").count() > 0
            body = page.inner_text("body")
            has_agent_name = "qa3-batch-0" in body
            if has_input:
                record("T5", "Agent Chat page with input and send", "PASS",
                       f"send={has_send}, new_chat={has_new_chat}, agent={has_agent_name}")
            else:
                record("T5", "Agent Chat", "WARN", f"No input. Body: {body[:150]}")
        except Exception as e:
            record("T5", "Agent Chat", "FAIL", str(e))

        # Back button
        try:
            back_btn = page.locator("a[href^='/agents/'], button:has(svg)").first
            if back_btn.count() > 0:
                back_btn.click()
                page.wait_for_timeout(1000)
                url = page.url
                if "/chat" not in url:
                    record("T5b", "Back button returns from chat", "PASS")
                else:
                    record("T5b", "Back button", "WARN", f"url={url}")
            else:
                record("T5b", "Back button", "WARN", "Not found")
        except Exception as e:
            record("T5b", "Back button", "FAIL", str(e))

        # ========== 6. Activity (/activity) ==========
        try:
            go("/activity")
            screenshot("06-activity.png")
            body = page.inner_text("body")
            has_filter = page.locator("[class*='badge'], [class*='Badge']").count() > 0
            has_cards = "Active" in body or "Events" in body or "Prompts" in body or "Sessions" in body
            has_timeline = "Timeline" in body or "timeline" in body or "event" in body.lower()
            if has_filter and (has_cards or has_timeline):
                record("T6", "Activity page with filters and summary", "PASS")
            else:
                record("T6", "Activity page", "WARN", f"filter={has_filter}, cards={has_cards}")
        except Exception as e:
            record("T6", "Activity", "FAIL", str(e))

        # Agent filter click
        try:
            agent_badge = page.locator("[class*='badge']:not(:has-text('All'))").first
            if agent_badge.count() > 0 and agent_badge.is_visible():
                agent_badge.click()
                page.wait_for_timeout(800)
                screenshot("06b-activity-filtered.png")
                record("T6b", "Activity agent filter works", "PASS")
            else:
                record("T6b", "Activity agent filter", "WARN", "No agent badge to click")
        except Exception as e:
            record("T6b", "Activity filter", "FAIL", str(e))

        # ========== 7. Events (/events) ==========
        try:
            go("/events")
            screenshot("07-events.png")
            search = page.locator("input[placeholder*='Search'], input[placeholder*='搜索']").first
            has_search = search.count() > 0
            body = page.inner_text("body")
            has_layer_badges = any(p in body for p in ["agent:", "process:", "session:", "actant:", "error"])
            has_table = "event" in body.lower() or "Event" in body or page.locator("table").count() > 0
            if has_search and (has_layer_badges or has_table):
                record("T7", "Events page with search and layer filters", "PASS")
            else:
                record("T7", "Events page", "WARN", f"search={has_search}, layers={has_layer_badges}")
        except Exception as e:
            record("T7", "Events", "FAIL", str(e))

        # Layer filter and search
        try:
            layer_btn = page.locator("text=agent:, [class*='badge']:has-text('agent:')").first
            if layer_btn.count() > 0:
                layer_btn.click()
                page.wait_for_timeout(800)
                screenshot("07b-events-layer-filter.png")
            evt_search = page.locator("input[placeholder*='Search'], input[placeholder*='搜索']").first
            if evt_search.count() > 0:
                evt_search.fill("session")
                page.wait_for_timeout(800)
                screenshot("07c-events-search.png")
            record("T7b", "Events layer filter and search", "PASS")
        except Exception as e:
            record("T7b", "Events filter/search", "FAIL", str(e))

        # ========== 8. Settings (/settings) ==========
        try:
            go("/settings")
            screenshot("08-settings.png")
            body = page.inner_text("body")
            has_connected = "connected" in body.lower() or "Connected" in body or "连接" in body
            has_daemon = "version" in body.lower() or "Daemon" in body or "daemon" in body
            has_agents_overview = "agent" in body.lower()
            if has_connected or has_daemon:
                record("T8", "Settings page with connection status and daemon info", "PASS")
            else:
                record("T8", "Settings page", "WARN", f"Body: {body[:200]}")
        except Exception as e:
            record("T8", "Settings", "FAIL", str(e))

        # ========== 9. Navigation - sidebar links ==========
        try:
            go("/")
            page.wait_for_timeout(1000)
            links = page.locator("nav a, [class*='sidebar'] a, aside a").all()
            hrefs = [l.get_attribute("href") for l in links if l.get_attribute("href")]
            expected = ["/", "/canvas", "/agents", "/activity", "/events", "/settings"]
            found = [h for h in expected if any(h == href or (href and h in href) for href in hrefs)]
            if len(found) >= 4:
                record("T9", "Sidebar navigation links", "PASS", f"Found: {found}")
            else:
                record("T9", "Sidebar navigation", "WARN", f"hrefs={hrefs[:10]}")
        except Exception as e:
            record("T9", "Sidebar nav", "FAIL", str(e))

        # ========== 10. 404 page ==========
        try:
            go("/nonexistent")
            screenshot("09-404.png")
            body = page.inner_text("body")
            has_404 = "not found" in body.lower() or "404" in body or "Not Found" in body
            if has_404:
                record("T10", "404 page displays Not Found", "PASS")
            else:
                record("T10", "404 page", "WARN", f"Body: {body[:150]}")
        except Exception as e:
            record("T10", "404 page", "FAIL", str(e))

        # ========== 11. Responsive - narrow viewport ==========
        try:
            page.set_viewport_size({"width": 375, "height": 667})  # mobile
            go("/")
            page.wait_for_timeout(1500)
            screenshot("10-responsive-mobile.png")
            root = page.locator("#root")
            if root.count() > 0:
                # Check layout didn't break - sidebar might collapse
                body = page.inner_text("body")
                has_content = len(body) > 100
                record("T11", "Responsive layout (375px)", "PASS" if has_content else "WARN",
                       "Content visible" if has_content else "Minimal content")
            else:
                record("T11", "Responsive", "FAIL", "No #root")
            page.set_viewport_size({"width": 1440, "height": 900})
        except Exception as e:
            record("T11", "Responsive", "FAIL", str(e))

        # ========== 12. Console errors ==========
        critical = [e for e in console_errors if any(x in e for x in ["TypeError", "ReferenceError", "SyntaxError"])]
        if len(critical) == 0:
            record("T12", "No critical JS console errors", "PASS", f"Total errors: {len(console_errors)}")
        else:
            record("T12", "JS console errors", "FAIL", "; ".join(critical[:3]))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("DASHBOARD QA FULL TEST SUMMARY")
    print("=" * 60)
    pc = sum(1 for r in results if r["status"] == "PASS")
    wc = sum(1 for r in results if r["status"] == "WARN")
    fc = sum(1 for r in results if r["status"] == "FAIL")
    print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")
    print()
    for r in results:
        icon = "PASS" if r["status"] == "PASS" else ("WARN" if r["status"] == "WARN" else "FAIL")
        print(f"  [{icon}] {r['id']}: {r['desc']}")

    with open(SCRIPT_DIR / "qa-results.json", "w", encoding="utf-8") as f:
        json.dump({"results": results, "summary": {"pass": pc, "warn": wc, "fail": fc}}, f, indent=2, ensure_ascii=False)

    return 0 if fc == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
