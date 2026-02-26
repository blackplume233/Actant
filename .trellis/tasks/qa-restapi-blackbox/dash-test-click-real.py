"""Test dropdown click WITHOUT force=True - real user simulation."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # visible browser
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    print("=== Real user click test (no force, no opacity hack) ===")

    # Step 1: Find agent cards
    body = page.inner_text("body")
    print(f"Agents visible: {'reviewer' in body}, {'qa-agent' in body}")

    # Step 2: Check button visibility before hover
    btns = page.locator("button:has(svg)").all()
    print(f"SVG buttons count: {len(btns)}")
    for i, btn in enumerate(btns):
        visible = btn.is_visible()
        bb = btn.bounding_box()
        print(f"  Button {i}: visible={visible}, bbox={bb}")

    # Step 3: Hover over first card to trigger group-hover
    print("\n--- Hovering over first card ---")
    first_card = page.locator("text=reviewer").first
    first_card.hover()
    page.wait_for_timeout(500)

    # Check button visibility after hover
    for i, btn in enumerate(btns):
        visible = btn.is_visible()
        bb = btn.bounding_box()
        # Check computed opacity
        opacity = btn.evaluate("el => window.getComputedStyle(el).opacity")
        pointer = btn.evaluate("el => window.getComputedStyle(el).pointerEvents")
        print(f"  Button {i}: visible={visible}, opacity={opacity}, pointerEvents={pointer}, bbox={bb}")

    # Step 4: Try normal click (no force)
    print("\n--- Clicking dropdown trigger (normal click) ---")
    try:
        btn0 = btns[0]
        btn0.hover()
        page.wait_for_timeout(300)
        opacity_after_hover = btn0.evaluate("el => window.getComputedStyle(el).opacity")
        print(f"  Button opacity after direct hover: {opacity_after_hover}")
        btn0.click(timeout=5000)
        page.wait_for_timeout(600)
        items = page.locator("[role='menuitem']").count()
        print(f"  [{'PASS' if items > 0 else 'FAIL'}] Menu items: {items}")
        if items > 0:
            texts = [page.locator("[role='menuitem']").nth(i).inner_text() for i in range(items)]
            print(f"  Items: {texts}")
        page.screenshot(path=f"{SDIR}/30-real-click.png")
    except Exception as e:
        print(f"  [ERROR] {e}")
        page.screenshot(path=f"{SDIR}/30-real-click-fail.png")

    # Step 5: Check if Card onClick fired instead
    print(f"\n--- Current URL: {page.url} ---")
    if "/agents/reviewer" in page.url and "/agents" != page.url.rstrip("/"):
        print("  [ISSUE] Card onClick fired — navigated to agent detail instead of opening dropdown!")
    else:
        print("  [OK] Stayed on agents page")

    # Step 6: Check the HTML structure of the dropdown trigger
    print("\n--- DOM structure around trigger ---")
    html = page.evaluate("""() => {
        const cards = document.querySelectorAll('[class*="Card"]');
        if (cards.length > 0) {
            const card = cards[0];
            const btns = card.querySelectorAll('button');
            return Array.from(btns).map(b => ({
                tag: b.tagName,
                class: b.className.slice(-80),
                parent: b.parentElement?.tagName + '.' + (b.parentElement?.className || '').slice(-40),
                grandparent: b.parentElement?.parentElement?.tagName + '.' + (b.parentElement?.parentElement?.className || '').slice(-40),
            }));
        }
        return 'no cards';
    }""")
    print(f"  {html}")

    browser.close()
