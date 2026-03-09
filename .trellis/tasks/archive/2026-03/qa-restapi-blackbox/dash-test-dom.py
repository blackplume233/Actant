"""DOM inspection for dropdown and chat elements."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    # Inspect agent card dropdown
    print("=== Agents page DOM inspection ===")
    page.goto(f"{BASE}/agents", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    # Find all buttons and their attributes
    all_buttons = page.locator("button").all()
    print(f"Total buttons on page: {len(all_buttons)}")
    for i, btn in enumerate(all_buttons):
        try:
            html = btn.inner_html()[:100]
            classes = btn.get_attribute("class") or ""
            aria = btn.get_attribute("aria-haspopup") or ""
            visible = btn.is_visible()
            if visible and ("svg" in html.lower() or "trigger" in classes.lower() or aria):
                print(f"  Button {i}: visible={visible}, aria-haspopup={aria}, class=...{classes[-60:]}")
                print(f"    HTML: {html}")
        except:
            pass

    # Try clicking the doc-writer card's button directly by position
    print("\n=== Click MoreVertical by finding it in doc-writer card area ===")
    # doc-writer is the 3rd card
    cards = page.locator("[class*='CardHeader'], [class*='card-header']").all()
    print(f"CardHeader elements: {len(cards)}")
    
    # Alternative: find button with DropdownMenuTrigger behavior
    triggers = page.locator("[data-state]").all()
    print(f"Elements with data-state: {len(triggers)}")
    for t in triggers:
        try:
            tag = t.evaluate("el => el.tagName")
            state = t.get_attribute("data-state")
            print(f"  {tag} data-state={state}")
        except:
            pass

    # Try clicking by exact position - the ⋮ button is at top-right of last card
    print("\n=== Try clicking MoreVertical via stopPropagation area ===")
    # Get the third card and click its trigger
    page.locator("text=doc-writer").first.hover()
    page.wait_for_timeout(500)
    # Evaluate to find the trigger button
    btn_info = page.evaluate("""() => {
        const buttons = document.querySelectorAll('button');
        return Array.from(buttons).map((b, i) => ({
            i, tag: b.tagName, 
            hasPopup: b.getAttribute('aria-haspopup'),
            dataState: b.getAttribute('data-state'),
            cls: (b.className || '').slice(-80),
            visible: b.offsetParent !== null,
            rect: b.getBoundingClientRect()
        })).filter(b => b.hasPopup || b.dataState);
    }""")
    for info in btn_info:
        print(f"  Btn {info['i']}: haspopup={info['hasPopup']}, state={info['dataState']}, visible={info['visible']}, x={info['rect']['x']:.0f} y={info['rect']['y']:.0f}")

    # Now inspect chat page
    print("\n=== Chat page DOM inspection ===")
    page.goto(f"{BASE}/agents/reviewer/chat", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    inputs = page.locator("input, textarea").all()
    print(f"Input elements: {len(inputs)}")
    for inp in inputs:
        try:
            tag = inp.evaluate("el => el.tagName")
            ph = inp.get_attribute("placeholder") or ""
            typ = inp.get_attribute("type") or ""
            visible = inp.is_visible()
            print(f"  {tag} type={typ} placeholder='{ph}' visible={visible}")
        except:
            pass

    btns = page.locator("button").all()
    print(f"Buttons: {len(btns)}")
    for btn in btns:
        try:
            visible = btn.is_visible()
            text = btn.inner_text().strip()[:30]
            disabled = btn.get_attribute("disabled")
            if visible:
                print(f"  Button: '{text}' disabled={disabled}")
        except:
            pass

    browser.close()
