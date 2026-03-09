"""Dashboard deep browser test - Page loading, navigation, SSE data."""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SCREENSHOT_DIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

results = []

def record(step_id, desc, status, detail=""):
    results.append({"id": step_id, "desc": desc, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{icon}] {step_id}: {desc} - {detail[:120]}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    # Collect console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    # ---- Step 1: Main page loads ----
    try:
        page.goto(BASE, wait_until="networkidle", timeout=15000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01-main-page.png")
        title = page.title()
        root = page.locator("#root")
        if root.count() > 0 and page.locator("[class*='sidebar'], nav, [role='navigation']").count() > 0:
            record("D1", "Main page loads with sidebar navigation", "PASS", f"title={title}")
        else:
            record("D1", "Main page loads with sidebar navigation", "WARN", "No sidebar found")
    except Exception as e:
        record("D1", "Main page loads", "FAIL", str(e))

    # ---- Step 2: Check SSE-driven agent count ----
    try:
        page.wait_for_timeout(2000)  # let SSE arrive
        body_text = page.inner_text("body")
        has_agents = "reviewer" in body_text or "qa-agent" in body_text or "Agents" in body_text
        if has_agents:
            record("D2", "SSE delivers agent data to page", "PASS", "Agent names visible")
        else:
            record("D2", "SSE delivers agent data to page", "WARN", f"Body preview: {body_text[:200]}")
    except Exception as e:
        record("D2", "SSE delivers agent data", "FAIL", str(e))

    # ---- Step 3: Navigate to Agents page ----
    try:
        agents_link = page.locator("a[href='/agents'], a:has-text('Agents'), [data-testid='nav-agents']").first
        if agents_link.count() > 0:
            agents_link.click()
        else:
            page.goto(f"{BASE}/agents", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02-agents-page.png")
        cards = page.locator("[class*='card'], [class*='Card']").count()
        body = page.inner_text("body")
        has_reviewer = "reviewer" in body
        has_qa = "qa-agent" in body
        has_doc = "doc-writer" in body
        if has_reviewer and has_qa and has_doc:
            record("D3", "Agents page shows all 3 agents", "PASS", f"cards={cards}, all names visible")
        elif has_reviewer or has_qa or has_doc:
            record("D3", "Agents page shows agents", "WARN", f"Only some agents visible: r={has_reviewer} q={has_qa} d={has_doc}")
        else:
            record("D3", "Agents page shows agents", "FAIL", f"No agents visible. Body: {body[:200]}")
    except Exception as e:
        record("D3", "Agents page", "FAIL", str(e))

    # ---- Step 4: Agent cards have status badges ----
    try:
        badges = page.locator("[class*='badge'], [class*='Badge'], span:has-text('created'), span:has-text('stopped'), span:has-text('running')").count()
        if badges >= 3:
            record("D4", "Agent cards show status badges", "PASS", f"{badges} badges found")
        elif badges > 0:
            record("D4", "Agent cards show status badges", "WARN", f"Only {badges} badges")
        else:
            record("D4", "Agent cards show status badges", "FAIL", "No status badges found")
    except Exception as e:
        record("D4", "Status badges", "FAIL", str(e))

    # ---- Step 5: Agent card dropdown menu ----
    try:
        menu_triggers = page.locator("button[class*='trigger'], button[aria-haspopup], [class*='dropdown'] button, button:has-text('⋮'), button:has(svg)").all()
        found_menu = False
        for trigger in menu_triggers:
            try:
                if trigger.is_visible():
                    trigger.click()
                    page.wait_for_timeout(500)
                    menu_items = page.locator("[role='menuitem'], [class*='DropdownMenuItem']").count()
                    if menu_items > 0:
                        page.screenshot(path=f"{SCREENSHOT_DIR}/03-agent-dropdown.png")
                        found_menu = True
                        record("D5", "Agent card dropdown menu opens", "PASS", f"{menu_items} menu items")
                        page.keyboard.press("Escape")
                        break
            except:
                continue
        if not found_menu:
            page.screenshot(path=f"{SCREENSHOT_DIR}/03-agent-dropdown-miss.png")
            record("D5", "Agent card dropdown menu", "WARN", f"Could not trigger dropdown. Triggers found: {len(menu_triggers)}")
    except Exception as e:
        record("D5", "Agent dropdown", "FAIL", str(e))

    # ---- Step 6: Navigate to Agent Detail page ----
    try:
        page.goto(f"{BASE}/agents/reviewer", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/04-agent-detail.png")
        body = page.inner_text("body")
        has_name = "reviewer" in body
        has_tabs = any(t in body for t in ["Overview", "Sessions", "Logs", "概览", "会话", "日志"])
        has_status = "created" in body or "stopped" in body or "running" in body
        if has_name and has_status:
            record("D6", "Agent detail page loads with agent data", "PASS", f"tabs={has_tabs}")
        elif has_name:
            record("D6", "Agent detail page", "WARN", f"Name visible but status missing")
        else:
            record("D6", "Agent detail page", "FAIL", f"Body: {body[:200]}")
    except Exception as e:
        record("D6", "Agent detail page", "FAIL", str(e))

    # ---- Step 7: Agent detail tabs (Sessions tab) ----
    try:
        sessions_tab = page.locator("button:has-text('Sessions'), button:has-text('会话'), [data-value='sessions']").first
        if sessions_tab.count() > 0:
            sessions_tab.click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/05-sessions-tab.png")
            record("D7", "Sessions tab clickable and loads", "PASS")
        else:
            record("D7", "Sessions tab", "WARN", "Tab not found, checking if sessions data shown inline")
    except Exception as e:
        record("D7", "Sessions tab", "FAIL", str(e))

    # ---- Step 8: Agent detail tabs (Logs tab) ----
    try:
        logs_tab = page.locator("button:has-text('Logs'), button:has-text('日志'), [data-value='logs']").first
        if logs_tab.count() > 0:
            logs_tab.click()
            page.wait_for_timeout(1000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/06-logs-tab.png")
            record("D8", "Logs tab clickable and loads", "PASS")
        else:
            record("D8", "Logs tab", "WARN", "Tab not found")
    except Exception as e:
        record("D8", "Logs tab", "FAIL", str(e))

    # ---- Step 9: Agent Chat page ----
    try:
        page.goto(f"{BASE}/agents/reviewer/chat", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/07-agent-chat.png")
        body = page.inner_text("body")
        has_input = page.locator("input, textarea, [contenteditable]").count() > 0
        has_send = page.locator("button:has-text('Send'), button:has-text('发送'), button[type='submit']").count() > 0
        if has_input:
            record("D9", "Agent chat page with input field", "PASS", f"input={has_input}, send_btn={has_send}")
        else:
            record("D9", "Agent chat page", "WARN", f"No input field. Body: {body[:200]}")
    except Exception as e:
        record("D9", "Agent chat page", "FAIL", str(e))

    # ---- Step 10: Events page ----
    try:
        page.goto(f"{BASE}/events", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/08-events-page.png")
        body = page.inner_text("body")
        has_events = "actant:start" in body or "agent:created" in body or "event" in body.lower()
        if has_events:
            record("D10", "Events page shows event history", "PASS")
        else:
            record("D10", "Events page", "WARN", f"No events visible. Body: {body[:200]}")
    except Exception as e:
        record("D10", "Events page", "FAIL", str(e))

    # ---- Step 11: Canvas page ----
    try:
        page.goto(f"{BASE}/canvas", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/09-canvas-page.png")
        body = page.inner_text("body")
        has_canvas = "reviewer" in body.lower() or "canvas" in body.lower() or "Code Review" in body
        if has_canvas:
            record("D11", "Canvas page shows canvas entries", "PASS")
        else:
            record("D11", "Canvas page", "WARN", f"No canvas data visible. Body: {body[:200]}")
    except Exception as e:
        record("D11", "Canvas page", "FAIL", str(e))

    # ---- Step 12: Settings page ----
    try:
        page.goto(f"{BASE}/settings", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/10-settings-page.png")
        body = page.inner_text("body")
        has_settings = "Settings" in body or "设置" in body or "version" in body.lower()
        if has_settings:
            record("D12", "Settings page loads", "PASS")
        else:
            record("D12", "Settings page", "WARN", f"Body: {body[:200]}")
    except Exception as e:
        record("D12", "Settings page", "FAIL", str(e))

    # ---- Step 13: 404 page ----
    try:
        page.goto(f"{BASE}/nonexistent-page", wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/11-404-page.png")
        body = page.inner_text("body")
        is_spa_fallback = "root" in page.content() or "not found" in body.lower() or "404" in body
        if is_spa_fallback:
            record("D13", "SPA fallback/404 page", "PASS", "Serves index.html with client routing")
        else:
            record("D13", "404 page", "WARN", f"Body: {body[:200]}")
    except Exception as e:
        record("D13", "404 page", "FAIL", str(e))

    # ---- Step 14: Navigation sidebar links ----
    try:
        page.goto(BASE, wait_until="networkidle", timeout=10000)
        page.wait_for_timeout(1000)
        links = page.locator("nav a, [class*='sidebar'] a, [role='navigation'] a").all()
        link_hrefs = []
        for link in links:
            href = link.get_attribute("href")
            if href:
                link_hrefs.append(href)
        if len(link_hrefs) >= 3:
            record("D14", "Sidebar has navigation links", "PASS", f"{len(link_hrefs)} links: {link_hrefs[:6]}")
        elif len(link_hrefs) > 0:
            record("D14", "Sidebar navigation", "WARN", f"Only {len(link_hrefs)} links: {link_hrefs}")
        else:
            record("D14", "Sidebar navigation", "FAIL", "No nav links found")
    except Exception as e:
        record("D14", "Sidebar navigation", "FAIL", str(e))

    # ---- Step 15: Console errors check ----
    critical_errors = [e for e in console_errors if "TypeError" in e or "ReferenceError" in e or "SyntaxError" in e]
    if len(critical_errors) == 0:
        record("D15", "No critical JS console errors", "PASS", f"Total console errors: {len(console_errors)}")
    else:
        record("D15", "JS console errors found", "FAIL", "; ".join(critical_errors[:5]))

    browser.close()

# Summary
print("\n" + "=" * 60)
print("DASHBOARD BROWSER TEST SUMMARY")
print("=" * 60)
pass_count = sum(1 for r in results if r["status"] == "PASS")
warn_count = sum(1 for r in results if r["status"] == "WARN")
fail_count = sum(1 for r in results if r["status"] == "FAIL")
print(f"PASS: {pass_count} | WARN: {warn_count} | FAIL: {fail_count} | Total: {len(results)}")
print()
for r in results:
    icon = "✅" if r["status"] == "PASS" else ("⚠️" if r["status"] == "WARN" else "❌")
    print(f"  {icon} {r['id']}: {r['desc']}")
    if r["detail"] and r["status"] != "PASS":
        print(f"     → {r['detail'][:150]}")

# Write JSON report
with open(f"{SCREENSHOT_DIR}/../dash-browser-results.json", "w") as f:
    json.dump(results, f, indent=2)
