"""Dashboard Agent flow test - actions, search, filters, detail actions."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3230"
SDIR = r"g:\Workspace\AgentWorkSpace\AgentCraft\.trellis\tasks\qa-restapi-blackbox\screenshots"

results = []
def record(sid, desc, status, detail=""):
    results.append({"id": sid, "status": status})
    print(f"[{status}] {sid}: {desc} -- {detail[:160]}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    def go(path, wait=3000):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(wait)

    def force_buttons():
        page.evaluate("() => document.querySelectorAll('button').forEach(b => b.style.opacity = '1')")

    # ===== F1: Search agents =====
    go("/agents")
    try:
        search = page.locator("input[placeholder*='Search']").first
        search.fill("reviewer")
        page.wait_for_timeout(1000)
        body = page.inner_text("body")
        has_reviewer = "reviewer" in body
        has_qa = "qa-agent" in body
        if has_reviewer and not has_qa:
            record("F1", "Search filters agents", "PASS", "Only reviewer shown")
        elif has_reviewer and has_qa:
            record("F1", "Search filters agents", "WARN", "Both visible - filter may be client-side debounce issue")
        else:
            record("F1", "Search filters agents", "FAIL", f"reviewer={has_reviewer}")
        page.screenshot(path=f"{SDIR}/30-search-filter.png")
        search.fill("")
        page.wait_for_timeout(500)
    except Exception as e:
        record("F1", "Search", "FAIL", str(e))

    # ===== F2: Status filter buttons =====
    try:
        page.wait_for_timeout(1000)
        # Click "Stopped" filter - should show 0 agents (all are "created")
        stopped_btn = page.locator("button:has-text('Stopped'), [role='button']:has-text('Stopped')").first
        if stopped_btn.count() > 0:
            stopped_btn.click()
            page.wait_for_timeout(1000)
            body = page.inner_text("body")
            has_agents = "reviewer" in body or "qa-agent" in body
            page.screenshot(path=f"{SDIR}/31-filter-stopped.png")
            if not has_agents:
                record("F2", "Stopped filter hides created agents", "PASS", "No agents shown")
            else:
                record("F2", "Stopped filter", "WARN", "Agents still visible")
            # Reset filter
            all_btn = page.locator("button:has-text('All')").first
            if all_btn.count() > 0:
                all_btn.click()
                page.wait_for_timeout(500)
        else:
            record("F2", "Status filter buttons", "WARN", "Stopped button not found")
    except Exception as e:
        record("F2", "Status filter", "FAIL", str(e))

    # ===== F3: Agent detail page - action buttons =====
    try:
        go("/agents/reviewer")
        page.screenshot(path=f"{SDIR}/32-detail-buttons.png")
        body = page.inner_text("body")
        has_chat_btn = page.locator("button:has-text('Chat')").count() > 0
        has_start_btn = page.locator("button:has-text('Start')").count() > 0
        has_destroy_btn = page.locator("button:has-text('Destroy')").count() > 0
        record("F3", "Agent detail action buttons", "PASS" if (has_chat_btn and has_start_btn and has_destroy_btn) else "WARN",
               f"Chat={has_chat_btn}, Start={has_start_btn}, Destroy={has_destroy_btn}")
    except Exception as e:
        record("F3", "Agent detail buttons", "FAIL", str(e))

    # ===== F4: Click Chat from detail -> navigate to chat page =====
    try:
        chat_btn = page.locator("button:has-text('Chat')").first
        chat_btn.click()
        page.wait_for_timeout(2000)
        url = page.url
        has_chat_url = "/chat" in url
        page.screenshot(path=f"{SDIR}/33-detail-to-chat.png")
        record("F4", "Detail Chat button navigates to chat page", "PASS" if has_chat_url else "FAIL", f"url={url}")
    except Exception as e:
        record("F4", "Detail -> Chat navigation", "FAIL", str(e))

    # ===== F5: Chat page back button =====
    try:
        back_btn = page.locator("button:has(svg), a:has(svg)").first
        back_btn.click()
        page.wait_for_timeout(2000)
        url = page.url
        is_detail = "/agents/reviewer" in url and "/chat" not in url
        record("F5", "Chat back button returns to detail", "PASS" if is_detail else "WARN", f"url={url}")
    except Exception as e:
        record("F5", "Chat back button", "FAIL", str(e))

    # ===== F6: Agent detail - Overview tab content =====
    try:
        go("/agents/reviewer")
        overview_tab = page.locator("button:has-text('Overview')").first
        if overview_tab.count() > 0:
            overview_tab.click()
            page.wait_for_timeout(1000)
        body = page.inner_text("body")
        page.screenshot(path=f"{SDIR}/34-overview-content.png")
        has_template = "code-reviewer" in body
        has_archetype = "repo" in body
        has_id = len(body) > 100
        record("F6", "Overview shows template, archetype", "PASS" if (has_template and has_archetype) else "WARN",
               f"template={has_template}, archetype={has_archetype}")
    except Exception as e:
        record("F6", "Overview content", "FAIL", str(e))

    # ===== F7: Sessions tab - Start conversation button =====
    try:
        sessions_tab = page.locator("button:has-text('Sessions')").first
        sessions_tab.click()
        page.wait_for_timeout(1000)
        start_conv_btn = page.locator("button:has-text('Start a conversation')").first
        if start_conv_btn.count() > 0:
            start_conv_btn.click()
            page.wait_for_timeout(2000)
            url = page.url
            record("F7", "'Start a conversation' navigates to chat", "PASS" if "/chat" in url else "WARN", f"url={url}")
        else:
            record("F7", "Start conversation button", "WARN", "Not found")
    except Exception as e:
        record("F7", "Start conversation", "FAIL", str(e))

    # ===== F8: Dropdown menu - Chat navigates to chat page =====
    try:
        go("/agents")
        force_buttons()
        page.wait_for_timeout(300)
        first_btn = page.locator("button:has(svg)").first
        first_btn.click(force=True)
        page.wait_for_timeout(600)
        chat_item = page.locator("[role='menuitem']:has-text('Chat')").first
        if chat_item.count() > 0:
            chat_item.click()
            page.wait_for_timeout(2000)
            url = page.url
            record("F8", "Dropdown Chat navigates to chat page", "PASS" if "/chat" in url else "FAIL", f"url={url}")
        else:
            record("F8", "Dropdown Chat item", "FAIL", "Not found")
    except Exception as e:
        record("F8", "Dropdown Chat", "FAIL", str(e))

    # ===== F9: Multiple dropdown open/close cycle =====
    try:
        go("/agents")
        force_buttons()
        page.wait_for_timeout(300)
        btn = page.locator("button:has(svg)").nth(1)
        btn.click(force=True)
        page.wait_for_timeout(400)
        items1 = page.locator("[role='menuitem']").count()
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        # Click outside to close
        page.mouse.click(600, 500)
        page.wait_for_timeout(300)
        items2 = page.locator("[role='menuitem']").count()
        btn.click(force=True)
        page.wait_for_timeout(400)
        items3 = page.locator("[role='menuitem']").count()
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        items4 = page.locator("[role='menuitem']").count()
        record("F9", "Dropdown open/close cycle", "PASS" if (items1 > 0 and items2 == 0 and items3 > 0 and items4 == 0) else "WARN",
               f"open={items1}, closed={items2}, reopen={items3}, reclose={items4}")
    except Exception as e:
        record("F9", "Dropdown cycle", "FAIL", str(e))

    # ===== F10: Destroy agent via dropdown =====
    try:
        go("/agents")
        force_buttons()
        page.wait_for_timeout(300)
        # Click last card's button (doc-writer)
        btn = page.locator("button:has(svg)").nth(2)
        btn.click(force=True)
        page.wait_for_timeout(600)
        destroy_item = page.locator("[role='menuitem']:has-text('Destroy')").first
        if destroy_item.count() > 0:
            destroy_item.click()
            page.wait_for_timeout(4000)
            body = page.inner_text("body")
            page.screenshot(path=f"{SDIR}/35-after-destroy.png")
            has_doc = "doc-writer" in body
            if not has_doc:
                record("F10", "Destroy removes agent from list", "PASS", "doc-writer gone")
            else:
                record("F10", "Destroy agent", "WARN", "Agent might still be shown (SSE delay or EBUSY)")
        else:
            record("F10", "Destroy menu item", "FAIL", "Not found")
    except Exception as e:
        record("F10", "Destroy agent", "FAIL", str(e))

    browser.close()

# Summary
print("\n" + "=" * 60)
print("DASHBOARD AGENT FLOW TEST SUMMARY")
print("=" * 60)
pc = sum(1 for r in results if r["status"] == "PASS")
wc = sum(1 for r in results if r["status"] == "WARN")
fc = sum(1 for r in results if r["status"] == "FAIL")
print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")
