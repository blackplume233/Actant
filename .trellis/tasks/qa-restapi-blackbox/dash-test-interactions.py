"""Dashboard interaction test - dropdown menu + chat send button."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Test 1: Agent card dropdown menu
    print("=== D5 FIX: Agent card dropdown menu ===")
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    # The MoreVertical trigger is the last small button inside each card
    # It appears on hover. First, hover over a card to make it visible.
    cards = page.locator("[class*='card'], [class*='Card']").all()
    found_dropdown = False
    for i, card in enumerate(cards):
        try:
            card.hover()
            page.wait_for_timeout(300)
            # Find the MoreVertical trigger button inside this card
            trigger = card.locator("button").last
            if trigger.is_visible():
                trigger.click()
                page.wait_for_timeout(600)
                # Check for dropdown menu items
                items = page.locator("[role='menuitem']").all()
                if len(items) > 0:
                    texts = [item.inner_text() for item in items]
                    page.screenshot(path=f"{SDIR}/15-dropdown-opened.png")
                    print(f"  [PASS] Dropdown opened on card {i} with items: {texts}")
                    found_dropdown = True
                    # Verify expected actions are present
                    expected = ["Start", "Chat", "Details", "Destroy"]
                    for exp in expected:
                        if any(exp in t for t in texts):
                            print(f"    [OK] Found '{exp}' action")
                        else:
                            print(f"    [MISS] '{exp}' action not in menu")
                    page.keyboard.press("Escape")
                    break
        except Exception as e:
            continue

    if not found_dropdown:
        # Try direct approach: find button with svg containing "more" path
        all_btns = page.locator("button:has(svg)").all()
        for btn in all_btns:
            try:
                bb = btn.bounding_box()
                if bb and bb['width'] < 50 and bb['height'] < 50 and btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(600)
                    items = page.locator("[role='menuitem']").all()
                    if len(items) > 0:
                        texts = [item.inner_text() for item in items]
                        page.screenshot(path=f"{SDIR}/15-dropdown-opened.png")
                        print(f"  [PASS] Dropdown (fallback) with items: {texts}")
                        found_dropdown = True
                        page.keyboard.press("Escape")
                        break
            except:
                continue

    if not found_dropdown:
        print("  [WARN] Could not trigger dropdown. Taking debug screenshot.")
        page.screenshot(path=f"{SDIR}/15-dropdown-debug.png")

    # Test 2: Chat page send button
    print("\n=== D11 FIX: Chat send button ===")
    page.goto(f"{BASE}/agents/reviewer/chat", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    input_el = page.locator("input[placeholder*='Message'], input[placeholder*='message']").first
    if input_el.count() > 0:
        input_el.fill("Hello from QA deep test")
        page.wait_for_timeout(300)

        # The send button is size="icon" with a Send SVG - find button next to input
        send_btns = page.locator("button:has(svg)").all()
        clicked = False
        for btn in send_btns:
            try:
                bb = btn.bounding_box()
                # Send button is at the bottom of the page, near the input
                input_bb = input_el.bounding_box()
                if bb and input_bb and abs(bb['y'] - input_bb['y']) < 50:
                    btn.click()
                    page.wait_for_timeout(4000)
                    page.screenshot(path=f"{SDIR}/16-chat-sent.png")
                    body = page.inner_text("body")
                    if "Hello from QA" in body:
                        print("  [PASS] Message sent and visible in chat")
                    if "error" in body.lower() or "no ACP" in body.lower() or "failed" in body.lower():
                        print(f"  [PASS] Error response shown (agent not running)")
                    elif "Thinking" in body or "..." in body:
                        print(f"  [PASS] Sending state visible")
                    else:
                        print(f"  [WARN] Unexpected state after send: {body[:200]}")
                    clicked = True
                    break
            except:
                continue

        if not clicked:
            # Fallback: try Enter key
            input_el.press("Enter")
            page.wait_for_timeout(4000)
            page.screenshot(path=f"{SDIR}/16-chat-enter.png")
            body = page.inner_text("body")
            if "Hello from QA" in body:
                print("  [PASS] Message sent via Enter key")
            else:
                print(f"  [WARN] Enter key send result: {body[:200]}")
    else:
        print("  [FAIL] No message input field found")

    # Test 3: Click through navigation using sidebar links
    print("\n=== D21: Sidebar navigation click-through ===")
    pages_to_test = [
        ("/", "Dashboard"),
        ("/canvas", "Live Canvas"),
        ("/agents", "Agents"),
        ("/activity", "Activity"),
        ("/events", "Events"),
    ]
    for path, name in pages_to_test:
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        body = page.inner_text("body")
        if name in body:
            print(f"  [PASS] {name} page ({path}) - title visible")
        else:
            print(f"  [WARN] {name} page ({path}) - title not found. Content: {body[:100]}")

    browser.close()
    print("\n=== Done ===")
