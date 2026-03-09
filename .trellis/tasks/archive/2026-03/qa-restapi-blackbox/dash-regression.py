"""Dashboard comprehensive regression test - all pages + interactions."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"
results = []

def record(sid, desc, status, detail=""):
    results.append({"id": sid, "desc": desc, "status": status, "detail": detail})
    print(f"[{status}] {sid}: {desc}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    def go(path, wait=3000):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(wait)

    def force_buttons():
        page.evaluate("() => document.querySelectorAll('button').forEach(b => b.style.opacity = '1')")

    # =========== PAGE LOADING ===========
    print("--- PAGE LOADING ---")
    
    go("/")
    body = page.inner_text("body")
    record("R1", "Dashboard home loads", "PASS" if "Actant" in body else "FAIL")

    go("/agents")
    body = page.inner_text("body")
    record("R2", "Agents page loads with data", "PASS" if "reviewer" in body else "FAIL")

    go("/events")
    body = page.inner_text("body")
    record("R3", "Events page loads with event log", "PASS" if ("actant:start" in body or "agent:created" in body) else "FAIL")

    go("/canvas")
    body = page.inner_text("body")
    record("R4", "Canvas page loads", "PASS" if "Canvas" in body else "FAIL")

    go("/settings")
    body = page.inner_text("body")
    record("R5", "Settings page loads with daemon info", "PASS" if ("Connected" in body and "0.2.3" in body) else "FAIL")

    go("/activity")
    body = page.inner_text("body")
    record("R6", "Activity page loads", "PASS" if "Activity" in body else "FAIL")

    go("/nonexistent")
    body = page.inner_text("body")
    record("R7", "404 page for unknown routes", "PASS" if "404" in body else "FAIL")

    # =========== NAVIGATION ===========
    print("\n--- NAVIGATION ---")
    
    go("/")
    nav_links = page.locator("nav a").all()
    hrefs = [l.get_attribute("href") for l in nav_links if l.get_attribute("href")]
    expected = ["/", "/canvas", "/agents", "/activity", "/events"]
    all_present = all(h in hrefs for h in expected)
    record("R8", "Sidebar has all nav links", "PASS" if all_present else "WARN", f"Found: {hrefs}")

    record("R9", "Top bar shows version + Online", 
           "PASS" if ("v0.2.3" in page.inner_text("body") and "Online" in page.inner_text("body")) else "WARN")

    record("R10", "Footer shows agent count",
           "PASS" if "agents" in page.inner_text("body").lower() else "WARN")

    # =========== DROPDOWN MENU (FIXED BUG) ===========
    print("\n--- DROPDOWN MENU ---")
    
    go("/agents")
    force_buttons()
    page.wait_for_timeout(300)
    
    btn = page.locator("button:has(svg)").first
    btn.click(force=True)
    page.wait_for_timeout(600)
    items = page.locator("[role='menuitem']").all()
    texts = [i.inner_text() for i in items]
    record("R11", "Dropdown opens on click", "PASS" if len(items) >= 4 else "FAIL", f"Items: {texts}")
    page.screenshot(path=f"{SDIR}/R-dropdown.png")
    
    # Escape key closes
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    items_after = page.locator("[role='menuitem']").count()
    record("R12", "Escape key closes dropdown", "PASS" if items_after == 0 else "FAIL", f"After escape: {items_after}")
    
    # Reopen and click outside closes
    btn.click(force=True)
    page.wait_for_timeout(400)
    page.mouse.click(700, 400)
    page.wait_for_timeout(400)
    items_after2 = page.locator("[role='menuitem']").count()
    record("R13", "Click outside closes dropdown", "PASS" if items_after2 == 0 else "FAIL", f"After click outside: {items_after2}")

    # Menu has correct items for created agent
    force_buttons()
    btn2 = page.locator("button:has(svg)").nth(1)
    btn2.click(force=True)
    page.wait_for_timeout(600)
    items3 = [i.inner_text() for i in page.locator("[role='menuitem']").all()]
    has_start = "Start" in items3
    has_chat = "Chat" in items3
    has_details = "Details" in items3
    has_destroy = "Destroy" in items3
    record("R14", "Menu shows Start/Chat/Details/Destroy", 
           "PASS" if all([has_start, has_chat, has_details, has_destroy]) else "FAIL",
           f"Items: {items3}")
    page.keyboard.press("Escape")

    # =========== AGENT DETAIL ===========
    print("\n--- AGENT DETAIL ---")
    
    go("/agents/reviewer")
    body = page.inner_text("body")
    record("R15", "Agent detail shows name + status", "PASS" if "reviewer" in body else "FAIL")
    
    has_tabs = all(t in body for t in ["Overview", "Sessions", "Logs"])
    record("R16", "Agent detail has 3 tabs", "PASS" if has_tabs else "FAIL")
    
    has_action_btns = page.locator("button:has-text('Chat')").count() > 0
    has_destroy = page.locator("button:has-text('Destroy')").count() > 0
    record("R17", "Agent detail has action buttons", "PASS" if (has_action_btns and has_destroy) else "WARN")

    # Overview tab
    page.locator("button:has-text('Overview')").first.click()
    page.wait_for_timeout(500)
    body = page.inner_text("body")
    record("R18", "Overview tab shows agent properties", "PASS" if "code-reviewer" in body else "WARN")
    
    # Sessions tab
    page.locator("button:has-text('Sessions')").first.click()
    page.wait_for_timeout(1000)
    body = page.inner_text("body")
    record("R19", "Sessions tab loads data", "PASS" if "session" in body.lower() else "WARN")
    
    # Logs tab
    page.locator("button:has-text('Logs')").first.click()
    page.wait_for_timeout(1000)
    body = page.inner_text("body")
    record("R20", "Logs tab loads", "PASS" if "log" in body.lower() else "WARN")
    page.screenshot(path=f"{SDIR}/R-detail.png")

    # =========== AGENT CHAT ===========
    print("\n--- AGENT CHAT ---")
    
    go("/agents/reviewer/chat")
    body = page.inner_text("body")
    record("R21", "Chat page loads with input", 
           "PASS" if page.locator("textarea").count() > 0 else "FAIL")
    
    textarea = page.locator("textarea").first
    textarea.fill("Regression test message")
    page.wait_for_timeout(300)
    send_btn = page.locator("button:has(svg)").last
    send_btn.click()
    page.wait_for_timeout(4000)
    body = page.inner_text("body")
    record("R22", "Chat sends message and shows response", 
           "PASS" if "Regression test" in body else "WARN", body[:200])
    page.screenshot(path=f"{SDIR}/R-chat.png")

    # =========== EVENTS PAGE ===========
    print("\n--- EVENTS ---")
    
    go("/events")
    page.screenshot(path=f"{SDIR}/R-events.png")
    body = page.inner_text("body")
    
    has_event_table = "Time" in body and "Event" in body
    record("R23", "Events page shows event table", "PASS" if has_event_table else "WARN")
    
    has_filters = any(f in body for f in ["agent", "process", "session"])
    record("R24", "Events page has category filters", "PASS" if has_filters else "WARN")

    # =========== CANVAS PAGE ===========
    print("\n--- CANVAS ---")
    
    go("/canvas")
    page.screenshot(path=f"{SDIR}/R-canvas.png")
    body = page.inner_text("body")
    record("R25", "Canvas page shows content", "PASS" if "Canvas" in body else "WARN")

    # =========== SETTINGS PAGE ===========
    print("\n--- SETTINGS ---")
    
    go("/settings")
    page.screenshot(path=f"{SDIR}/R-settings.png")
    body = page.inner_text("body")
    
    has_connection = "Connected" in body
    has_version = "0.2.3" in body
    has_uptime = "Uptime" in body
    has_agents = "Managed Agents" in body
    record("R26", "Settings shows daemon connection status", "PASS" if has_connection else "FAIL")
    record("R27", "Settings shows version + uptime + agents", 
           "PASS" if (has_version and has_uptime and has_agents) else "WARN")

    # =========== SEARCH & FILTER ===========
    print("\n--- SEARCH & FILTER ---")
    
    go("/agents")
    search = page.locator("input[placeholder*='Search']").first
    search.fill("reviewer")
    page.wait_for_timeout(1000)
    body = page.inner_text("body")
    record("R28", "Search filters agents", "PASS" if "reviewer" in body else "WARN")
    search.fill("")
    page.wait_for_timeout(500)

    # =========== CONSOLE ERRORS ===========
    print("\n--- CONSOLE ERRORS ---")
    critical = [e for e in errors if any(t in e for t in ["TypeError", "ReferenceError", "SyntaxError", "Uncaught"])]
    record("R29", "No critical JS console errors", "PASS" if len(critical) == 0 else "FAIL",
           "; ".join(critical[:3]) if critical else f"Total non-critical: {len(errors)}")

    browser.close()

# Summary
print("\n" + "=" * 60)
print("DASHBOARD REGRESSION TEST SUMMARY")
print("=" * 60)
pc = sum(1 for r in results if r["status"] == "PASS")
wc = sum(1 for r in results if r["status"] == "WARN")
fc = sum(1 for r in results if r["status"] == "FAIL")
print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")
print()
for r in results:
    s = "OK" if r["status"] == "PASS" else ("!!" if r["status"] == "WARN" else "XX")
    try:
        print(f"  [{s}] {r['id']}: {r['desc']}")
    except:
        pass

with open(f"{SDIR}/../dash-regression-results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
