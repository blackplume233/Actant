"""Real user click test - no force, no opacity hack."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    body = page.inner_text("body")
    print(f"Agents: test-alpha={'test-alpha' in body}, test-beta={'test-beta' in body}")

    # Step 1: Check button state BEFORE hover
    btns = page.locator("button:has(svg)").all()
    print(f"\nButtons before hover: {len(btns)}")
    for i, btn in enumerate(btns):
        try:
            opacity = btn.evaluate("el => getComputedStyle(el).opacity")
            pe = btn.evaluate("el => getComputedStyle(el).pointerEvents")
            print(f"  [{i}] opacity={opacity} pointer-events={pe}")
        except Exception as e:
            print(f"  [{i}] error: {e}")

    # Step 2: Hover over the first card
    print("\n--- Hover over first card ---")
    card = page.locator("[class*='group']").first
    card.hover()
    page.wait_for_timeout(500)
    for i, btn in enumerate(btns):
        try:
            opacity = btn.evaluate("el => getComputedStyle(el).opacity")
            print(f"  [{i}] opacity after card hover={opacity}")
        except:
            pass

    # Step 3: Hover over the button itself
    print("\n--- Hover over button directly ---")
    btn0 = btns[0]
    btn0.hover()
    page.wait_for_timeout(500)
    opacity = btn0.evaluate("el => getComputedStyle(el).opacity")
    print(f"  Button opacity after direct hover: {opacity}")

    # Step 4: Click the button (normal, no force)
    print("\n--- Click button (NO force) ---")
    try:
        btn0.click(timeout=5000)
        page.wait_for_timeout(800)
        items = page.locator("[role='menuitem']").count()
        url = page.url
        print(f"  Menu items after click: {items}")
        print(f"  URL after click: {url}")
        if items > 0:
            texts = [page.locator("[role='menuitem']").nth(i).inner_text() for i in range(items)]
            print(f"  [PASS] Dropdown opened! Items: {texts}")
            page.screenshot(path=f"{SDIR}/40-click-v3-pass.png")
        elif "/agents/" in url and url != f"{BASE}/agents":
            print("  [FAIL] Card onClick fired - navigated away!")
            page.screenshot(path=f"{SDIR}/40-click-v3-nav.png")
        else:
            print("  [FAIL] No menu items and no navigation")
            page.screenshot(path=f"{SDIR}/40-click-v3-empty.png")
    except Exception as e:
        print(f"  [ERROR] {e}")
        page.screenshot(path=f"{SDIR}/40-click-v3-error.png")

    # Step 5: If dropdown opened, test clicking a menu item
    items = page.locator("[role='menuitem']").count()
    if items > 0:
        print("\n--- Click 'Details' menu item ---")
        details = page.locator("[role='menuitem']:has-text('Details')").first
        details.click()
        page.wait_for_timeout(2000)
        url = page.url
        print(f"  URL after Details: {url}")
        if "/agents/test-alpha" in url:
            print("  [PASS] Navigated to agent detail")
        page.screenshot(path=f"{SDIR}/41-menu-click.png")

    browser.close()
    print("\n=== Done ===")
