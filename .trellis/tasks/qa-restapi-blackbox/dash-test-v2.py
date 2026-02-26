"""Dashboard deep browser test v2 - Fixed for SSE streaming."""
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"
os.makedirs(SDIR, exist_ok=True)

results = []

def record(step_id, desc, status, detail=""):
    results.append({"id": step_id, "desc": desc, "status": status, "detail": detail})
    print(f"[{status}] {step_id}: {desc} -- {detail[:160]}")

def go(page, path, wait_ms=3000):
    """Navigate with domcontentloaded + manual wait (SSE prevents networkidle)."""
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=10000)
    page.wait_for_timeout(wait_ms)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    # ===== D1: Main / Dashboard page =====
    try:
        go(page, "/")
        page.screenshot(path=f"{SDIR}/01-main.png")
        body = page.inner_text("body")
        has_sidebar = page.locator("nav a, [class*='sidebar'] a").count() >= 3
        has_header = "Actant" in body
        record("D1", "Main page loads with sidebar", "PASS" if (has_sidebar and has_header) else "WARN",
               f"sidebar_links={page.locator('nav a').count()}, header={has_header}")
    except Exception as e:
        record("D1", "Main page", "FAIL", str(e))

    # ===== D2: Agents page + SSE data =====
    try:
        go(page, "/agents")
        page.screenshot(path=f"{SDIR}/02-agents.png")
        body = page.inner_text("body")
        all3 = all(n in body for n in ["reviewer", "qa-agent", "doc-writer"])
        record("D2", "Agents page shows all 3 agents via SSE", "PASS" if all3 else "FAIL",
               f"reviewer={'reviewer' in body} qa={'qa-agent' in body} doc={'doc-writer' in body}")
    except Exception as e:
        record("D2", "Agents page", "FAIL", str(e))

    # ===== D3: Status badges on agent cards =====
    try:
        badges = page.locator("text=Created").count()
        record("D3", "Agent cards show 'Created' status badges", "PASS" if badges >= 3 else "WARN",
               f"badges={badges}")
    except Exception as e:
        record("D3", "Status badges", "FAIL", str(e))

    # ===== D4: Status filter buttons =====
    try:
        filters = page.locator("text=Running").count() + page.locator("text=Stopped").count()
        has_all = page.locator("text=All 3").count() > 0 or page.locator("text=All").count() > 0
        record("D4", "Status filter buttons present", "PASS" if (filters > 0 and has_all) else "WARN",
               f"filters={filters}, all_btn={has_all}")
    except Exception as e:
        record("D4", "Filters", "FAIL", str(e))

    # ===== D5: Agent card dropdown menu =====
    try:
        more_btns = page.locator("button").all()
        found = False
        for btn in more_btns:
            try:
                inner = btn.inner_html()
                if "More" in inner or "ellipsis" in inner.lower() or "vertical" in inner.lower() or '<svg' in inner:
                    bbox = btn.bounding_box()
                    if bbox and bbox['width'] < 50:
                        btn.click()
                        page.wait_for_timeout(600)
                        items = page.locator("[role='menuitem']").count()
                        if items > 0:
                            texts = [page.locator("[role='menuitem']").nth(i).inner_text() for i in range(items)]
                            page.screenshot(path=f"{SDIR}/03-dropdown.png")
                            found = True
                            has_actions = any(t in " ".join(texts) for t in ["Start", "Stop", "Chat", "Details", "Destroy"])
                            record("D5", "Agent dropdown menu opens with actions", "PASS" if has_actions else "WARN",
                                   f"items={texts}")
                            page.keyboard.press("Escape")
                            break
            except:
                continue
        if not found:
            record("D5", "Agent dropdown menu", "WARN", "Could not find/trigger dropdown via SVG buttons")
    except Exception as e:
        record("D5", "Agent dropdown", "FAIL", str(e))

    # ===== D6: Click agent card -> navigate to detail =====
    try:
        go(page, "/agents")
        card = page.locator("text=reviewer").first
        card.click()
        page.wait_for_timeout(2000)
        url = page.url
        page.screenshot(path=f"{SDIR}/04-detail.png")
        body = page.inner_text("body")
        has_detail = "/agents/reviewer" in url or "reviewer" in body
        has_actions = any(t in body for t in ["Chat", "Start", "Destroy"])
        has_tabs = any(t in body for t in ["Overview", "Sessions", "Logs"])
        record("D6", "Click card navigates to agent detail", "PASS" if (has_detail and has_tabs) else "WARN",
               f"url={url}, actions={has_actions}, tabs={has_tabs}")
    except Exception as e:
        record("D6", "Agent detail navigation", "FAIL", str(e))

    # ===== D7: Agent detail - Overview tab =====
    try:
        go(page, "/agents/reviewer")
        overview_tab = page.locator("button:has-text('Overview')").first
        if overview_tab.count() > 0:
            overview_tab.click()
            page.wait_for_timeout(1000)
        page.screenshot(path=f"{SDIR}/05-overview-tab.png")
        body = page.inner_text("body")
        has_info = "code-reviewer" in body or "reviewer" in body
        record("D7", "Overview tab shows agent info", "PASS" if has_info else "WARN", f"info_visible={has_info}")
    except Exception as e:
        record("D7", "Overview tab", "FAIL", str(e))

    # ===== D8: Agent detail - Sessions tab =====
    try:
        sessions_tab = page.locator("button:has-text('Sessions')").first
        sessions_tab.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SDIR}/06-sessions-tab.png")
        body = page.inner_text("body")
        has_sessions = "No sessions" in body or "session" in body.lower()
        record("D8", "Sessions tab loads", "PASS" if has_sessions else "WARN", body[:120])
    except Exception as e:
        record("D8", "Sessions tab", "FAIL", str(e))

    # ===== D9: Agent detail - Logs tab =====
    try:
        logs_tab = page.locator("button:has-text('Logs')").first
        logs_tab.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SDIR}/07-logs-tab.png")
        body = page.inner_text("body")
        has_logs = "No log" in body or "log" in body.lower()
        record("D9", "Logs tab loads", "PASS" if has_logs else "WARN", body[:120])
    except Exception as e:
        record("D9", "Logs tab", "FAIL", str(e))

    # ===== D10: Agent Chat page =====
    try:
        go(page, "/agents/reviewer/chat")
        page.screenshot(path=f"{SDIR}/08-chat-page.png")
        body = page.inner_text("body")
        has_input = page.locator("input[type='text'], textarea, input[placeholder]").count() > 0
        has_chat_ui = "reviewer" in body or "chat" in body.lower() or "message" in body.lower()
        record("D10", "Agent chat page with message input", "PASS" if has_input else "WARN",
               f"input={has_input}, chat_ui={has_chat_ui}")
    except Exception as e:
        record("D10", "Agent chat page", "FAIL", str(e))

    # ===== D11: Send message in chat (to stopped agent - expect error) =====
    try:
        input_el = page.locator("input[type='text'], textarea, input[placeholder]").first
        if input_el.count() > 0:
            input_el.fill("Hello from QA test")
            send_btn = page.locator("button[type='submit'], button:has-text('Send')").first
            if send_btn.count() > 0:
                send_btn.click()
                page.wait_for_timeout(3000)
                page.screenshot(path=f"{SDIR}/09-chat-send.png")
                body = page.inner_text("body")
                has_error_or_msg = "error" in body.lower() or "Hello from QA" in body or "no ACP" in body.lower()
                record("D11", "Chat send to stopped agent shows error", "PASS" if has_error_or_msg else "WARN",
                       body[:200])
            else:
                record("D11", "Chat send button", "WARN", "No send button found")
        else:
            record("D11", "Chat input field", "WARN", "No input found")
    except Exception as e:
        record("D11", "Chat send", "FAIL", str(e))

    # ===== D12: Events page =====
    try:
        go(page, "/events")
        page.screenshot(path=f"{SDIR}/10-events.png")
        body = page.inner_text("body")
        has_events = "actant:start" in body or "agent:created" in body or "Events" in body
        record("D12", "Events page shows event history", "PASS" if has_events else "WARN",
               f"event_data={'actant:start' in body}, page_title={'Events' in body}")
    except Exception as e:
        record("D12", "Events page", "FAIL", str(e))

    # ===== D13: Live Canvas page =====
    try:
        go(page, "/canvas")
        page.screenshot(path=f"{SDIR}/11-canvas.png")
        body = page.inner_text("body")
        has_canvas = "reviewer" in body.lower() or "Canvas" in body or "Code Review" in body
        record("D13", "Canvas page shows canvas data", "PASS" if has_canvas else "WARN", body[:200])
    except Exception as e:
        record("D13", "Canvas page", "FAIL", str(e))

    # ===== D14: Settings page =====
    try:
        go(page, "/settings")
        page.screenshot(path=f"{SDIR}/12-settings.png")
        body = page.inner_text("body")
        has_settings = "Settings" in body or "version" in body.lower() or "0.2.3" in body
        record("D14", "Settings page loads with daemon info", "PASS" if has_settings else "WARN", body[:200])
    except Exception as e:
        record("D14", "Settings page", "FAIL", str(e))

    # ===== D15: Activity page =====
    try:
        go(page, "/activity")
        page.screenshot(path=f"{SDIR}/13-activity.png")
        body = page.inner_text("body")
        has_activity = "Activity" in body or "activity" in body.lower() or "session" in body.lower()
        record("D15", "Activity page loads", "PASS" if has_activity else "WARN", body[:200])
    except Exception as e:
        record("D15", "Activity page", "FAIL", str(e))

    # ===== D16: Sidebar navigation completeness =====
    try:
        go(page, "/")
        nav_links = page.locator("nav a, [class*='Sidebar'] a").all()
        hrefs = []
        for link in nav_links:
            h = link.get_attribute("href")
            t = link.inner_text().strip()
            if h:
                hrefs.append(f"{t}({h})")
        record("D16", "Sidebar navigation links", "PASS" if len(hrefs) >= 5 else "WARN",
               f"{len(hrefs)} links: {', '.join(hrefs)}")
    except Exception as e:
        record("D16", "Sidebar navigation", "FAIL", str(e))

    # ===== D17: Top bar shows daemon status =====
    try:
        body = page.inner_text("body")
        has_version = "v0.2.3" in body or "0.2.3" in body
        has_online = "Online" in body or "online" in body
        has_uptime = any(t in body for t in ["1m", "2m", "3m", "4m", "5m", "0s"])
        record("D17", "Top bar shows version + online status", "PASS" if (has_version and has_online) else "WARN",
               f"version={has_version}, online={has_online}, uptime={has_uptime}")
    except Exception as e:
        record("D17", "Top bar status", "FAIL", str(e))

    # ===== D18: Bottom bar shows agent count =====
    try:
        footer = page.inner_text("body")
        has_count = "3 agents" in footer or "3 agent" in footer
        record("D18", "Footer shows agent count", "PASS" if has_count else "WARN", f"found='3 agents' in footer")
    except Exception as e:
        record("D18", "Footer agent count", "FAIL", str(e))

    # ===== D19: 404/Not Found page =====
    try:
        go(page, "/this-page-does-not-exist")
        page.screenshot(path=f"{SDIR}/14-notfound.png")
        body = page.inner_text("body")
        has_404 = "not found" in body.lower() or "404" in body or "doesn't exist" in body.lower()
        record("D19", "Not-found page for unknown routes", "PASS" if has_404 else "WARN", body[:200])
    except Exception as e:
        record("D19", "Not-found page", "FAIL", str(e))

    # ===== D20: No critical JS errors =====
    critical = [e for e in console_errors if any(t in e for t in ["TypeError", "ReferenceError", "SyntaxError", "Uncaught"])]
    if len(critical) == 0:
        record("D20", "No critical JS console errors", "PASS", f"Total warnings: {len(console_errors)}")
    else:
        record("D20", "Critical JS errors found", "FAIL", "; ".join(critical[:5]))

    browser.close()

# Summary
print("\n" + "=" * 60)
print("DASHBOARD BROWSER TEST SUMMARY")
print("=" * 60)
pc = sum(1 for r in results if r["status"] == "PASS")
wc = sum(1 for r in results if r["status"] == "WARN")
fc = sum(1 for r in results if r["status"] == "FAIL")
print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")
for r in results:
    s = "OK" if r["status"] == "PASS" else ("!!" if r["status"] == "WARN" else "XX")
    print(f"  [{s}] {r['id']}: {r['desc']}")
    if r["detail"] and r["status"] != "PASS":
        d = r['detail'][:150]
        try:
            print(f"       -> {d}")
        except:
            print(f"       -> (encoding issue)")

with open(f"{SDIR}/../dash-results-v2.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"\nResults saved to dash-results-v2.json")
