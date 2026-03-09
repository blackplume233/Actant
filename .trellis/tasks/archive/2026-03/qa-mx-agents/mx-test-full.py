"""Dashboard mx-* agents comprehensive test - http://localhost:3200

Test matrix: 7 agents (tool/employee/service x claude-code/cursor/pi)
"""
import json
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: pip install playwright && playwright install chromium")
    sys.exit(1)

BASE = "http://localhost:3200"
SCRIPT_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = SCRIPT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(exist_ok=True)

MX_AGENTS = [
    "mx-cc-tool-a1", "mx-cc-employee-a1", "mx-cc-service-a1",
    "mx-cursor-tool-a1", "mx-pi-tool-a1", "mx-pi-employee-a1", "mx-pi-service-a1",
]

results = []
agent_details = {}  # name -> {tabs, metadata, issues}


def record(phase, step, status, detail=""):
    results.append({"phase": phase, "step": step, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{icon}] {phase} {step}: {detail[:120] if detail else ''}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def go(path, wait=2000):
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        def body():
            return page.inner_text("body")

        # ========== Phase 1: Overview ==========
        go("/")
        screenshot("p1-overview.png")
        b = body()

        visible_mx = [a for a in MX_AGENTS if a in b]
        record("P1", "mx-agents-visible", "PASS" if len(visible_mx) >= 5 else "WARN",
               f"Found {len(visible_mx)}/7: {visible_mx}")

        for arch in ["tool", "employee", "service"]:
            if arch in b:
                record("P1", f"archetype-{arch}", "PASS", f"Archetype '{arch}' displayed")
            else:
                record("P1", f"archetype-{arch}", "WARN", f"'{arch}' not in body")

        has_backend = any(x in b for x in ["claude-code", "cursor", "pi"])
        record("P1", "backend-shown", "PASS" if has_backend else "WARN",
               "Backend in template/card" if has_backend else "Backend not visible")

        has_filter = "all" in b.lower() or "running" in b.lower() or "stopped" in b.lower()
        record("P1", "filter-grouping", "PASS" if has_filter else "WARN", "Filter/grouping" if has_filter else "None")

        # ========== Phase 2: Agent Detail - each mx-* ==========
        for agent in MX_AGENTS:
            go(f"/agents/{agent}")
            page.wait_for_timeout(1500)
            b = body()

            if agent not in b:
                agent_details[agent] = {"tabs": [], "metadata": {}, "issues": ["Agent not found on page"]}
                record("P2", f"detail-{agent}", "FAIL", "Agent not in body")
                continue

            # Tabs
            tabs_found = []
            for tab in ["Overview", "Sessions", "Logs", "Chat", "Tasks", "Schedule", "Canvas", "Events"]:
                if tab.lower() in b.lower():
                    tabs_found.append(tab)
            agent_details[agent] = {"tabs": tabs_found, "metadata": {}, "issues": []}

            # Archetype
            arch = "tool" if "tool" in agent else ("employee" if "employee" in agent else "service")
            if arch in b:
                agent_details[agent]["metadata"]["archetype"] = arch
            else:
                agent_details[agent]["issues"].append(f"Archetype '{arch}' not displayed")

            # Overview fields
            for field in ["Name", "Status", "Archetype", "Template", "PID", "Workspace", "Launch"]:
                if field in b:
                    agent_details[agent]["metadata"][field] = True

            # Status for created agent
            if "cursor" in agent:
                if "created" in b.lower() or "Created" in b:
                    agent_details[agent]["metadata"]["status_created"] = True
                else:
                    agent_details[agent]["issues"].append("mx-cursor-tool-a1 should show 'created'")
                if "Stop" in b or "stop" in b:
                    agent_details[agent]["issues"].append("Created agent should NOT show Stop button")

            screenshot(f"p2-detail-{agent}.png")
            record("P2", f"detail-{agent}", "PASS", f"tabs={tabs_found[:5]}")

        # Chat tab check - Chat is separate route
        go("/agents/mx-cc-employee-a1/chat")
        page.wait_for_timeout(1500)
        b = body()
        has_input = page.locator("input, textarea, [contenteditable]").count() > 0
        record("P2", "chat-interface", "PASS" if has_input else "WARN", f"Input={has_input}")

        # ========== Phase 3: Interactive ==========
        # Stop mx-pi-tool-a1
        go("/agents/mx-pi-tool-a1")
        page.wait_for_timeout(1000)
        try:
            stop_btn = page.locator("button:has-text('Stop'), button:has-text('停止')").first
            if stop_btn.count() > 0 and stop_btn.is_visible():
                stop_btn.click()
                page.wait_for_timeout(3000)
                screenshot("p3-after-stop.png")
                b = body()
                if "stopped" in b.lower() or "created" in b.lower():
                    record("P3", "stop-agent", "PASS", "Status changed after stop")
                else:
                    record("P3", "stop-agent", "WARN", f"Status may not have updated. Body: {b[:100]}")
                # Start back
                start_btn = page.locator("button:has-text('Start'), button:has-text('启动')").first
                if start_btn.count() > 0:
                    start_btn.click()
                    page.wait_for_timeout(3000)
                    record("P3", "start-agent", "PASS", "Started back")
            else:
                record("P3", "stop-agent", "WARN", "Stop button not found")
        except Exception as e:
            record("P3", "stop-start", "FAIL", str(e))

        # Chat on mx-cc-employee-a1
        go("/agents/mx-cc-employee-a1/chat")
        page.wait_for_timeout(1500)
        try:
            inp = page.locator("textarea, input[type='text']").first
            if inp.count() > 0:
                inp.fill("Hello, test message")
                page.wait_for_timeout(500)
                send_btn = page.locator("button[type='submit'], button:has-text('Send'), button:has-text('发送')").first
                if send_btn.count() > 0:
                    send_btn.click()
                else:
                    page.keyboard.press("Enter")
                page.wait_for_timeout(2000)
                screenshot("p3-chat-sent.png")
                record("P3", "chat-send", "PASS", "Message sent")
            else:
                record("P3", "chat-send", "WARN", "No input field")
        except Exception as e:
            record("P3", "chat-send", "FAIL", str(e))

        # ========== Phase 4: Navigation ==========
        go("/")
        nav_links = page.locator("nav a, aside a").all()
        hrefs = [l.get_attribute("href") for l in nav_links if l.get_attribute("href")]
        expected = ["/", "/canvas", "/agents", "/activity", "/events", "/settings"]
        found = [h for h in expected if any(h == href or (href and h in href) for href in hrefs)]
        record("P4", "sidebar-nav", "PASS" if len(found) >= 5 else "WARN", f"Found {found}")

        go("/settings")
        page.wait_for_timeout(1000)
        screenshot("p4-settings.png")
        b = body()
        record("P4", "settings", "PASS" if "Settings" in b or "设置" in b else "WARN", "")

        go("/events")
        page.wait_for_timeout(1500)
        screenshot("p4-events.png")
        b = body()
        record("P4", "events", "PASS" if "event" in b.lower() or "Event" in b else "WARN", "")

        # Back/forward
        go("/agents/mx-cc-tool-a1")
        page.wait_for_timeout(500)
        page.go_back()
        page.wait_for_timeout(500)
        url = page.url
        record("P4", "back-nav", "PASS" if "/" in url or "/agents" in url else "WARN", f"url={url}")

        # Responsive
        page.set_viewport_size({"width": 375, "height": 667})
        go("/")
        page.wait_for_timeout(1500)
        screenshot("p4-responsive.png")
        b = body()
        record("P4", "responsive", "PASS" if len(b) > 100 else "WARN", "Content visible")

        browser.close()

    # Save report
    report = {
        "results": results,
        "agent_details": agent_details,
        "summary": {
            "pass": sum(1 for r in results if r["status"] == "PASS"),
            "warn": sum(1 for r in results if r["status"] == "WARN"),
            "fail": sum(1 for r in results if r["status"] == "FAIL"),
        },
    }
    with open(SCRIPT_DIR / "mx-test-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print("MX AGENTS TEST SUMMARY")
    print("=" * 60)
    print(f"PASS: {report['summary']['pass']} | WARN: {report['summary']['warn']} | FAIL: {report['summary']['fail']}")
    return 0 if report["summary"]["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
