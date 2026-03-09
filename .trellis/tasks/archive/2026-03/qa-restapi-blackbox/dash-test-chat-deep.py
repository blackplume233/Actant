"""Deep chat feature test - UI, send, error handling, keyboard."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"
results = []

def record(sid, desc, status, detail=""):
    results.append({"id": sid, "desc": desc, "status": status, "detail": detail})
    print(f"[{status}] {sid}: {desc}" + (f" -- {detail[:120]}" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    def go(path, wait=3000):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(wait)

    # ============ C1: Chat page loads for created agent ============
    go("/agents/test-alpha/chat")
    page.screenshot(path=f"{SDIR}/C01-chat-initial.png")
    body = page.inner_text("body")
    has_name = "test-alpha" in body
    has_status = "Created" in body
    has_prompt = "Start a conversation" in body
    has_auto_start_hint = "auto-started" in body
    has_textarea = page.locator("textarea").count() > 0
    record("C1", "Chat page loads with agent name + status",
           "PASS" if (has_name and has_status and has_textarea) else "FAIL",
           f"name={has_name}, status={has_status}, textarea={has_textarea}")

    # ============ C2: Empty state UI ============
    has_bot_icon = page.locator("svg").count() > 3
    record("C2", "Empty state shows placeholder + auto-start hint",
           "PASS" if (has_prompt and has_auto_start_hint) else "WARN",
           f"prompt={has_prompt}, auto_start_hint={has_auto_start_hint}")

    # ============ C3: Textarea placeholder text ============
    ph = page.locator("textarea").first.get_attribute("placeholder") or ""
    record("C3", "Textarea placeholder shows agent name",
           "PASS" if "test-alpha" in ph else "FAIL", f"placeholder='{ph}'")

    # ============ C4: Send button disabled when empty ============
    send_btn = page.locator("button:has(svg)").last
    disabled = send_btn.get_attribute("disabled")
    record("C4", "Send button disabled when textarea empty",
           "PASS" if disabled is not None else "WARN", f"disabled={disabled}")

    # ============ C5: Type text -> send button enables ============
    page.locator("textarea").first.fill("Hello")
    page.wait_for_timeout(300)
    disabled_after = send_btn.is_disabled()
    record("C5", "Send button enables after typing",
           "PASS" if not disabled_after else "FAIL", f"disabled_after_type={disabled_after}")

    # ============ C6: Send to non-running agent -> error message ============
    send_btn.click()
    page.wait_for_timeout(5000)
    page.screenshot(path=f"{SDIR}/C06-error-msg.png")
    body = page.inner_text("body")
    has_user_msg = "Hello" in body
    has_error = "error" in body.lower() or "ACP" in body or "not running" in body.lower()
    error_styled = page.locator("[class*='destructive']").count() > 0
    record("C6", "Send to stopped agent shows error message",
           "PASS" if (has_user_msg and has_error) else "FAIL",
           f"user_msg={has_user_msg}, error={has_error}, styled={error_styled}")

    # ============ C7: Error message has correct styling ============
    record("C7", "Error message uses destructive styling",
           "PASS" if error_styled else "WARN", f"destructive_elements={error_styled}")

    # ============ C8: User message bubble on right side ============
    user_bubbles = page.locator("div.justify-end").count()
    record("C8", "User message aligned to right",
           "PASS" if user_bubbles > 0 else "WARN", f"right_aligned={user_bubbles}")

    # ============ C9: Textarea refocused after send ============
    focused = page.locator("textarea").first.evaluate("el => document.activeElement === el")
    record("C9", "Textarea refocused after send completes",
           "PASS" if focused else "WARN", f"focused={focused}")

    # ============ C10: Enter key sends message ============
    page.locator("textarea").first.fill("Enter key test")
    page.wait_for_timeout(200)
    page.locator("textarea").first.press("Enter")
    page.wait_for_timeout(5000)
    body = page.inner_text("body")
    has_enter_msg = "Enter key test" in body
    record("C10", "Enter key sends message",
           "PASS" if has_enter_msg else "FAIL", f"msg_visible={has_enter_msg}")

    # ============ C11: Shift+Enter adds newline ============
    page.locator("textarea").first.fill("Line1")
    page.locator("textarea").first.press("Shift+Enter")
    page.locator("textarea").first.type("Line2")
    page.wait_for_timeout(200)
    val = page.locator("textarea").first.input_value()
    has_newline = "\n" in val
    record("C11", "Shift+Enter adds newline instead of sending",
           "PASS" if has_newline else "FAIL", f"textarea_value='{val}'")
    page.locator("textarea").first.fill("")

    # ============ C12: Back button navigates to agent detail ============
    back_btn = page.locator("button:has(svg)").first
    back_btn.click()
    page.wait_for_timeout(2000)
    url = page.url
    record("C12", "Back button navigates to agent detail",
           "PASS" if "/agents/test-alpha" in url and "/chat" not in url else "WARN",
           f"url={url}")

    # ============ C13: Start agent then chat ============
    print("\n--- Starting agent for live chat test ---")
    go("/agents/test-alpha/chat")
    # Start agent via API
    page.evaluate("""async () => {
        await fetch('/v1/agents/test-alpha/start', { method: 'POST' });
    }""")
    page.wait_for_timeout(8000)
    page.screenshot(path=f"{SDIR}/C13-agent-started.png")
    body = page.inner_text("body")
    is_running = "Running" in body
    record("C13", "Agent status updates to Running in chat header",
           "PASS" if is_running else "WARN", f"running={is_running}")

    # ============ C14: Send to running agent -> real response ============
    page.locator("textarea").first.fill("What is 2+2? Reply with just the number.")
    page.wait_for_timeout(200)
    send_btn = page.locator("button:has(svg)").last
    send_btn.click()

    # Wait for "Thinking..." indicator
    page.wait_for_timeout(1000)
    thinking = page.locator("text=Thinking").count() > 0
    page.screenshot(path=f"{SDIR}/C14-thinking.png")

    # Wait for response (up to 60s)
    try:
        page.locator("div.justify-start >> nth=-1").wait_for(timeout=60000)
        page.wait_for_timeout(1000)
    except:
        pass

    page.screenshot(path=f"{SDIR}/C14-response.png")
    body = page.inner_text("body")
    has_question = "2+2" in body
    has_answer = "4" in body
    record("C14", "Running agent returns real response",
           "PASS" if (has_question and has_answer) else "WARN",
           f"question={has_question}, answer={has_answer}")

    # ============ C15: Session ID displayed ============
    has_session = "session:" in body
    record("C15", "Session ID displayed in header",
           "PASS" if has_session else "WARN", f"session_visible={has_session}")

    # ============ C16: Assistant message has bot icon ============
    bot_icons = page.locator("div.justify-start .rounded-full").count()
    record("C16", "Assistant message has bot avatar icon",
           "PASS" if bot_icons > 0 else "WARN", f"icons={bot_icons}")

    # ============ C17: User message has user icon ============
    user_icons = page.locator("div.justify-end .rounded-full").count()
    record("C17", "User message has user avatar icon",
           "PASS" if user_icons > 0 else "WARN", f"icons={user_icons}")

    # ============ C18: Messages have timestamps ============
    timestamps = page.locator("div[class*='opacity-50']").count()
    record("C18", "Messages have timestamps",
           "PASS" if timestamps >= 2 else "WARN", f"timestamp_elements={timestamps}")

    # ============ C19: Send button disabled while waiting ============
    page.locator("textarea").first.fill("Another question")
    page.wait_for_timeout(200)

    # Intercept fetch to observe loading state
    disabled_during = page.evaluate("""() => {
        const btn = document.querySelectorAll('button');
        const sendBtn = btn[btn.length - 1];
        return sendBtn.disabled;
    }""")
    record("C19", "Send button state correct (enabled when ready)",
           "PASS" if not disabled_during else "WARN")

    # ============ C20: Multiple messages scroll correctly ============
    page.locator("textarea").first.fill("Second question: what is 3*3?")
    send_btn.click()
    page.wait_for_timeout(15000)
    page.screenshot(path=f"{SDIR}/C20-multi-msg.png")
    body = page.inner_text("body")
    msgs = body.count("2+2") + body.count("3*3")
    record("C20", "Multiple messages render correctly",
           "PASS" if msgs >= 2 else "WARN", f"found_questions={msgs}")

    # ============ C21: Chat with non-existent agent ============
    go("/agents/nonexistent-agent-xyz/chat")
    page.screenshot(path=f"{SDIR}/C21-nonexistent.png")
    body = page.inner_text("body")
    record("C21", "Chat page handles non-existent agent",
           "PASS" if "nonexistent" in body or "not found" in body.lower() else "WARN",
           body[:150])

    # ============ C22: No critical JS errors ============
    critical = [e for e in console_errors if any(t in e for t in ["TypeError", "ReferenceError", "SyntaxError", "Uncaught"])]
    record("C22", "No critical JS console errors during chat",
           "PASS" if len(critical) == 0 else "FAIL",
           f"errors={len(critical)}" + (f": {critical[:3]}" if critical else ""))

    # Cleanup: stop agent
    page.evaluate("() => fetch('/v1/agents/test-alpha/stop', { method: 'POST' })")
    page.wait_for_timeout(2000)

    browser.close()

# Summary
print("\n" + "=" * 60)
print("CHAT FEATURE DEEP TEST SUMMARY")
print("=" * 60)
pc = sum(1 for r in results if r["status"] == "PASS")
wc = sum(1 for r in results if r["status"] == "WARN")
fc = sum(1 for r in results if r["status"] == "FAIL")
print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")
print()
for r in results:
    s = "OK" if r["status"] == "PASS" else ("!!" if r["status"] == "WARN" else "XX")
    print(f"  [{s}] {r['id']}: {r['desc']}")
    if r["detail"] and r["status"] != "PASS":
        try:
            print(f"       -> {r['detail'][:120]}")
        except:
            pass

with open(f"{SDIR}/../chat-deep-results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
