"""Verify workspace directory is displayed in Agent Detail Overview tab."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3232"
AGENT = "chat-tester"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto(f"{BASE}/agents/{AGENT}", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    workspace_row = page.locator("text=Workspace").first
    if workspace_row.count() == 0:
        print("[FAIL] Workspace label not found in overview")
        browser.close()
        sys.exit(1)

    overview_card = page.locator("[class*='divide-y']").first
    workspace_value = overview_card.locator("div:has-text('Workspace') + span, div:has-text('Workspace') ~ span").first

    all_rows = overview_card.locator("> div").all()
    ws_text = ""
    for row in all_rows:
        text = row.text_content() or ""
        if "Workspace" in text:
            ws_text = text.replace("Workspace", "").strip()
            break

    page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/workspace-dir.png")
    browser.close()

    if "instances" in ws_text and "chat-tester" in ws_text:
        print(f"[PASS] Workspace directory shown: {ws_text}")
    elif ws_text == "—" or ws_text == "":
        print(f"[FAIL] Workspace still shows placeholder: '{ws_text}'")
        sys.exit(1)
    else:
        print(f"[WARN] Unexpected workspace text: '{ws_text}'")
