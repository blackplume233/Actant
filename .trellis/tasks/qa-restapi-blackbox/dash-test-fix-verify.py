"""Verify dropdown and chat fixes."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # === Test 1: Agent card dropdown ===
    print("=== D5 Verify: Agent card dropdown menu ===")
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    # The buttons have opacity-0, use JS to force visibility
    page.evaluate("""() => {
        document.querySelectorAll('button').forEach(b => {
            b.style.opacity = '1';
        });
    }""")
    page.wait_for_timeout(300)

    # Now find and click the first card's dropdown trigger
    buttons = page.locator("button:has(svg)").all()
    print(f"  Found {len(buttons)} SVG buttons")
    found = False
    for i, btn in enumerate(buttons):
        try:
            btn.click(force=True)
            page.wait_for_timeout(600)
            items = page.locator("[role='menuitem']").all()
            if len(items) > 0:
                texts = [item.inner_text() for item in items]
                page.screenshot(path=f"{SDIR}/20-dropdown-fixed.png")
                print(f"  [PASS] Dropdown opened! Items: {texts}")
                found = True

                # Verify correct items based on agent status (should be "created" -> show Start)
                has_start = any("Start" in t for t in texts)
                has_chat = any("Chat" in t for t in texts)
                has_details = any("Details" in t for t in texts)
                has_destroy = any("Destroy" in t for t in texts)
                print(f"    Start={has_start}, Chat={has_chat}, Details={has_details}, Destroy={has_destroy}")
                if has_start and has_chat and has_details and has_destroy:
                    print(f"    [PASS] All expected menu items present")
                else:
                    print(f"    [WARN] Some menu items missing")

                # Test: click Details navigates to agent detail
                details_item = page.locator("[role='menuitem']:has-text('Details')").first
                if details_item.count() > 0:
                    details_item.click()
                    page.wait_for_timeout(2000)
                    url = page.url
                    if "/agents/" in url:
                        print(f"    [PASS] Clicking Details navigated to {url}")
                    else:
                        print(f"    [WARN] URL after clicking Details: {url}")
                break
        except Exception as e:
            continue

    if not found:
        print("  [FAIL] Could not open dropdown")
        page.screenshot(path=f"{SDIR}/20-dropdown-fail.png")

    # === Test 2: Chat page send ===
    print("\n=== D11 Verify: Chat send button ===")
    page.goto(f"{BASE}/agents/reviewer/chat", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    # Find textarea
    textarea = page.locator("textarea").first
    if textarea.count() > 0:
        ph = textarea.get_attribute("placeholder") or ""
        print(f"  Found textarea with placeholder: '{ph}'")
        textarea.fill("QA test message for dropdown fix")
        page.wait_for_timeout(300)

        # Find the icon-only send button (next to textarea)
        send_btn = page.locator("button:has(svg)").last
        if send_btn.count() > 0 and send_btn.is_visible():
            send_btn.click()
            page.wait_for_timeout(4000)
            page.screenshot(path=f"{SDIR}/21-chat-sent.png")
            body = page.inner_text("body")
            has_msg = "QA test message" in body
            has_error = "error" in body.lower() or "failed" in body.lower() or "not running" in body.lower()
            if has_msg:
                print(f"  [PASS] Message visible in chat")
                if has_error:
                    print(f"  [PASS] Error displayed for non-running agent")
            else:
                print(f"  [WARN] Message not visible. Body: {body[:200]}")
        else:
            print("  [WARN] Send button not found/visible")
    else:
        print("  [FAIL] Textarea not found")

    # === Test 3: Dropdown on all cards ===
    print("\n=== D22: Dropdown on each agent card ===")
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    page.evaluate("""() => {
        document.querySelectorAll('button').forEach(b => b.style.opacity = '1');
    }""")
    
    buttons = page.locator("button:has(svg)").all()
    for i, btn in enumerate(buttons):
        try:
            btn.click(force=True)
            page.wait_for_timeout(600)
            items = page.locator("[role='menuitem']").count()
            if items > 0:
                print(f"  [PASS] Card {i}: Dropdown with {items} items")
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            else:
                pass
        except:
            pass

    browser.close()
    print("\n=== Verification complete ===")
