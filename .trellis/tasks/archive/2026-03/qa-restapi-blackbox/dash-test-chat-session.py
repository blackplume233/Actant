"""Verify chat session management: history loading, New Chat, session continuity."""
import sys, time
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

    # T1: Open chat — should load history from previous sessions
    page.goto(f"{BASE}/agents/{AGENT}/chat", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/chat-sess-1-load.png")

    bubbles = page.locator("[class*='rounded-2xl']").all()
    has_history = len(bubbles) > 0
    check("T1-history-loaded", has_history, f"{len(bubbles)} messages shown")

    # T2: Session banner visible
    banner = page.locator("text=previous").first
    has_banner = banner.count() > 0
    check("T2-session-banner", has_banner,
          banner.text_content()[:80] if has_banner else "no banner")

    # T3: New Chat button exists
    new_chat = page.locator("text=New Chat").first
    check("T3-new-chat-button", new_chat.count() > 0)

    # T4: Session ID shown in header
    sess_header = page.locator("[class*='font-mono']").first
    check("T4-session-id-header", sess_header.count() > 0,
          sess_header.text_content()[:30] if sess_header.count() > 0 else "none")

    # T5: Click New Chat — should clear messages
    if new_chat.count() > 0:
        new_chat.click()
        page.wait_for_timeout(3000)
        page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/chat-sess-2-new.png")

        post_clear_bubbles = page.locator("[class*='rounded-2xl']").all()
        # After new chat, either 0 messages or 1 system message
        system_msg = page.locator("text=New conversation started").first
        check("T5-new-chat-clears", len(post_clear_bubbles) == 0 or system_msg.count() > 0,
              f"{len(post_clear_bubbles)} bubbles, system msg: {system_msg.count() > 0}")
    else:
        check("T5-new-chat-clears", False, "button not found")

    # T6: Send a message in new session
    textarea = page.locator("textarea").first
    if textarea.count() > 0:
        textarea.fill("Hello from new session! What is 1+1?")
        send_btn = page.locator("button:has(svg)").last
        send_btn.click()
        page.wait_for_timeout(15000)
        page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/chat-sess-3-sent.png")

        response_bubbles = page.locator("[class*='bg-muted'][class*='rounded-2xl']").all()
        check("T6-message-sent-received", len(response_bubbles) > 0,
              f"{len(response_bubbles)} assistant responses")
    else:
        check("T6-message-sent-received", False, "no textarea")

    # T7: Navigate away and come back — history should persist
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    page.goto(f"{BASE}/agents/{AGENT}/chat", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)
    page.screenshot(path=".trellis/tasks/qa-restapi-blackbox/screenshots/chat-sess-4-return.png")

    return_bubbles = page.locator("[class*='rounded-2xl']").all()
    check("T7-history-persists-after-nav", len(return_bubbles) > 0,
          f"{len(return_bubbles)} messages on return")

    browser.close()

print("\n" + "=" * 60)
passes = sum(1 for _, s, _ in results if s == "PASS")
fails = sum(1 for _, s, _ in results if s == "FAIL")
print(f"TOTAL: {passes} PASS, {fails} FAIL out of {len(results)}")
sys.exit(1 if fails > 0 else 0)
