"""Verify Uptime displays in Agent Detail and Agent Card when agent is running."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3232"
AGENT = "chat-tester"

results = []

def check(name, ok, note=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, status, note))
    print(f"[{status}] {name}" + (f" — {note}" if note else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # T1: Agent Detail Overview - Uptime
    page.goto(f"{BASE}/agents/{AGENT}", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    all_rows = page.locator("[class*='divide-y'] > div").all()
    uptime_text = ""
    for row in all_rows:
        text = row.text_content() or ""
        if "Uptime" in text:
            uptime_text = text.replace("Uptime", "").strip()
            break

    has_uptime = any(u in uptime_text for u in ["s", "m", "h"])
    check("T1-uptime-in-detail", has_uptime, f"Uptime value: '{uptime_text}'")

    # T2: Workspace also shows
    ws_text = ""
    for row in all_rows:
        text = row.text_content() or ""
        if "Workspace" in text:
            ws_text = text.replace("Workspace", "").strip()
            break
    check("T2-workspace-in-detail", "instances" in ws_text, ws_text[:80])

    page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/uptime-detail.png")

    # T3: Agent Card shows uptime
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    card_text = page.locator(f"text={AGENT}").first.locator("..").locator("..").text_content() or ""
    has_card_uptime = any(u in card_text for u in ["0s", "1s", "2s", "3s", "4s", "5s", "1m", "2m"])
    # Also check for seconds/minutes pattern
    import re
    time_match = re.search(r'\d+[smh]', card_text)
    check("T3-uptime-in-card", time_match is not None, f"Card text contains: {time_match.group() if time_match else 'no time found'}")

    page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/uptime-card.png")

    browser.close()

print("\n" + "=" * 60)
passes = sum(1 for _, s, _ in results if s == "PASS")
fails = sum(1 for _, s, _ in results if s == "FAIL")
print(f"TOTAL: {passes} PASS, {fails} FAIL out of {len(results)}")
sys.exit(1 if fails > 0 else 0)
