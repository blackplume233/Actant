"""Verify session info completeness: Chat page loads history, Sessions tab shows correct data."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3231"
AGENT = "chat-tester"

results = []

def check(name, ok, note=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, status, note))
    print(f"[{status}] {name}" + (f" — {note}" if note else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # T1: Chat page loads history
    page.goto(f"{BASE}/agents/{AGENT}/chat", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    history_bubbles = page.locator("[class*='rounded-2xl']").all()
    check("T1-chat-history-loaded", len(history_bubbles) > 0,
          f"Found {len(history_bubbles)} message bubbles")

    has_user = any("bg-primary" in (b.get_attribute("class") or "") for b in history_bubbles)
    has_assistant = any("bg-muted" in (b.get_attribute("class") or "") for b in history_bubbles)
    check("T2-has-user-messages", has_user)
    check("T3-has-assistant-messages", has_assistant)

    session_text = page.locator("text=session:").text_content() if page.locator("text=session:").count() > 0 else ""
    check("T4-session-id-shown", "session:" in session_text, session_text.strip())

    first_user = page.locator("[class*='bg-primary text-primary']").first.text_content() if page.locator("[class*='bg-primary text-primary']").count() > 0 else ""
    check("T5-first-user-msg", "2+2" in first_user, f"Content: {first_user[:60]}")

    page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/sess-chat-history.png")

    # T6: Sessions tab
    page.goto(f"{BASE}/agents/{AGENT}", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)

    tabs = page.locator("button:has-text('Sessions')")
    if tabs.count() > 0:
        tabs.first.click()
        page.wait_for_timeout(2000)

        session_items = page.locator("text=msgs").all()
        check("T6-sessions-tab-items", len(session_items) > 0,
              f"Found {len(session_items)} session entries")

        sess_text = session_items[0].text_content() if session_items else ""
        check("T7-msgs-count-shown", "msgs" in sess_text, sess_text.strip())
        page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/sess-tab.png")

        # Click first session to view conversation
        session_buttons = page.locator("button:has-text('...')").all()
        if session_buttons:
            session_buttons[0].click()
            page.wait_for_timeout(2000)

            turns = page.locator("[class*='rounded-xl']").all()
            check("T8-session-turns-loaded", len(turns) > 0,
                  f"Found {len(turns)} turns in session detail")
            page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/sess-detail.png")
        else:
            check("T8-session-turns-loaded", False, "No session button found")
    else:
        check("T6-sessions-tab-items", False, "Sessions tab not found")
        check("T7-msgs-count-shown", False, "skipped")
        check("T8-session-turns-loaded", False, "skipped")

    browser.close()

print("\n" + "=" * 60)
passes = sum(1 for _, s, _ in results if s == "PASS")
fails = sum(1 for _, s, _ in results if s == "FAIL")
print(f"TOTAL: {passes} PASS, {fails} FAIL out of {len(results)}")
sys.exit(1 if fails > 0 else 0)
