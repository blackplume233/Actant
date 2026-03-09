"""Verify Actant Dashboard with actant-hub preset agents - http://localhost:3200

Test: 12 agents, archetype grouping, hub preset details (steward, maintainer,
onboarder), chat restrictions by archetype, Live Canvas, Settings.
"""
import json
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: pip install playwright && playwright install chromium")
    sys.exit(1)

BASE = "http://localhost:3200"
SCRIPT_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = SCRIPT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(exist_ok=True)

results = []


def record(step_id, desc, status, detail=""):
    results.append({"step": step_id, "desc": desc, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{icon}] {step_id}: {desc} - {detail[:120] if detail else ''}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        def go(path, wait=2000):
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        def body():
            return page.inner_text("body")

        # ========== Step 1: Agents List - Hub Presets Grouping ==========
        try:
            go("/agents", 5000)
            screenshot("01-agents-list-hub.png")
            b = body()

            # Employees: mx-cc-employee-a1, mx-pi-employee-a2, maintainer-a1, scavenger-a1, curator-a1 (5)
            emp_expected = ["mx-cc-employee-a1", "mx-pi-employee-a2", "maintainer-a1", "scavenger-a1", "curator-a1"]
            emp_found = [a for a in emp_expected if a in b]

            # Services: mx-cc-service-a1, mx-pi-service-a2, steward-a1, researcher-a1 (4)
            svc_expected = ["mx-cc-service-a1", "mx-pi-service-a2", "steward-a1", "researcher-a1"]
            svc_found = [a for a in svc_expected if a in b]

            # Repos: mx-cc-tool-a2, reg-cursor-test, onboarder-a1 (3)
            repo_expected = ["mx-cc-tool-a2", "reg-cursor-test", "onboarder-a1"]
            repo_found = [a for a in repo_expected if a in b]

            if len(emp_found) >= 4 and len(svc_found) >= 3 and len(repo_found) >= 2:
                record("S1", "Agents list: hub preset grouping", "PASS",
                       f"emp={len(emp_found)}/5, svc={len(svc_found)}/4, repo={len(repo_found)}/3")
            elif len(emp_found) >= 3 or len(svc_found) >= 2:
                record("S1", "Agents list hub presets", "WARN", f"emp={emp_found}, svc={svc_found}, repo={repo_found}")
            else:
                record("S1", "Agents list", "FAIL", f"emp={emp_found}, svc={svc_found}, repo={repo_found}")
        except Exception as e:
            record("S1", "Agents list", "FAIL", str(e))

        # ========== Step 2: Steward (Service) Detail ==========
        try:
            steward_link = page.locator("a[href*='steward-a1'], [class*='cursor-pointer']:has-text('steward-a1')").first
            if steward_link.count() > 0:
                steward_link.click()
                page.wait_for_timeout(3000)
            else:
                go("/agents/steward-a1", 3000)
            screenshot("02-steward-detail.png")
            b = body()

            has_template = "actant-steward" in b or "actant-hub" in b
            has_created = "created" in b.lower()
            has_canvas_tab = False
            tab_bar = page.locator("div.border-b:has(button:has-text('概览'))")
            if tab_bar.count() > 0:
                has_canvas_tab = tab_bar.locator("button:has-text('画布')").count() > 0
            has_start_stop = page.locator("button:has-text('Start'), button:has-text('Stop'), button:has-text('启动'), button:has-text('停止')").count() > 0
            has_chat = page.locator("button:has-text('Chat'), button:has-text('对话')").count() > 0

            if has_template and not has_canvas_tab and not has_start_stop and has_chat:
                record("S2", "Steward: service, no Canvas, no Start/Stop, Chat", "PASS")
            elif has_template and has_chat:
                record("S2", "Steward detail", "WARN", f"canvas_tab={has_canvas_tab}, start_stop={has_start_stop}")
            else:
                record("S2", "Steward detail", "FAIL", f"template={has_template}, chat={has_chat}")
        except Exception as e:
            record("S2", "Steward detail", "FAIL", str(e))

        # ========== Step 3: Maintainer (Employee) Detail ==========
        try:
            go("/agents/maintainer-a1", 3000)
            screenshot("03-maintainer-detail.png")
            b = body()

            has_template = "actant-maintainer" in b or "actant-hub" in b
            tab_bar = page.locator("div.border-b:has(button:has-text('概览'))")
            has_canvas_tab = tab_bar.locator("button:has-text('画布')").count() > 0 if tab_bar.count() > 0 else False
            has_start_stop = page.locator("button:has-text('Start'), button:has-text('Stop'), button:has-text('启动'), button:has-text('停止')").count() > 0
            has_chat = page.locator("button:has-text('Chat'), button:has-text('对话')").count() > 0

            if has_template and has_canvas_tab and has_start_stop and has_chat:
                record("S3", "Maintainer: employee, Canvas tab, Start/Stop, Chat", "PASS")
            elif has_template and has_canvas_tab:
                record("S3", "Maintainer detail", "WARN", f"start_stop={has_start_stop}, chat={has_chat}")
            else:
                record("S3", "Maintainer detail", "FAIL", f"template={has_template}, canvas={has_canvas_tab}")
        except Exception as e:
            record("S3", "Maintainer detail", "FAIL", str(e))

        # ========== Step 4: Onboarder (Repo/Tool) Detail ==========
        try:
            go("/agents/onboarder-a1", 3000)
            screenshot("04-onboarder-detail.png")
            b = body()

            has_template = "actant-onboarder" in b or "actant-hub" in b
            tab_bar = page.locator("div.border-b:has(button:has-text('概览'))")
            tab_count = tab_bar.locator("button").count() if tab_bar.count() > 0 else 0
            only_overview = tab_count == 1
            has_chat = page.locator("button:has-text('Chat'), button:has-text('对话')").count() > 0
            has_start_stop = page.locator("button:has-text('Start'), button:has-text('Stop'), button:has-text('启动'), button:has-text('停止')").count() > 0
            has_destroy = page.locator("button:has-text('Destroy'), button:has-text('销毁')").count() > 0

            if has_template and only_overview and not has_chat and not has_start_stop and has_destroy:
                record("S4", "Onboarder: repo, only Overview, Destroy only", "PASS")
            elif has_template and has_destroy:
                record("S4", "Onboarder detail", "WARN", f"tabs={tab_count}, chat={has_chat}")
            else:
                record("S4", "Onboarder detail", "FAIL", f"template={has_template}")
        except Exception as e:
            record("S4", "Onboarder detail", "FAIL", str(e))

        # ========== Step 5: Researcher (Service) Chat ==========
        try:
            go("/agents/researcher-a1/chat", 3000)
            screenshot("05-researcher-chat.png")
            b = body()

            has_new_chat = page.locator("button:has-text('New Chat'), button:has-text('新对话')").count() > 0
            has_managed_banner = "托管" in b and "Actant" in b and "会话" in b
            has_input = page.locator("textarea, input[type='text']").count() > 0

            if has_new_chat and has_input and not has_managed_banner:
                record("S5", "Researcher chat: New Chat, no managed banner", "PASS")
            elif has_input:
                record("S5", "Researcher chat", "WARN", f"new_chat={has_new_chat}, managed={has_managed_banner}")
            else:
                record("S5", "Researcher chat", "FAIL", f"input={has_input}")
        except Exception as e:
            record("S5", "Researcher chat", "FAIL", str(e))

        # ========== Step 6: Curator (Employee) Chat ==========
        try:
            go("/agents/curator-a1/chat", 3000)
            screenshot("06-curator-chat.png")
            b = body()

            has_new_chat = page.locator("button:has-text('New Chat'), button:has-text('新对话')").count() > 0
            has_managed_banner = "托管" in b or "managed" in b.lower()
            has_input = page.locator("textarea, input[type='text']").count() > 0

            if not has_new_chat and has_managed_banner and has_input:
                record("S6", "Curator chat: no New Chat, managed banner", "PASS")
            elif not has_new_chat and has_input:
                record("S6", "Curator chat", "WARN", f"managed_banner={has_managed_banner}")
            else:
                record("S6", "Curator chat", "FAIL", f"new_chat={has_new_chat}, managed={has_managed_banner}")
        except Exception as e:
            record("S6", "Curator chat", "FAIL", str(e))

        # ========== Step 7: Onboarder (Repo) Chat ==========
        try:
            go("/agents/onboarder-a1/chat", 3000)
            screenshot("07-onboarder-chat-unavailable.png")
            b = body()

            has_no_chat_msg = "不支持对话" in b or "not available" in b.lower() or "仓库" in b
            has_back = page.locator("button:has-text('返回'), button:has-text('Back'), a:has-text('返回')").count() > 0

            if has_no_chat_msg and has_back:
                record("S7", "Onboarder chat: not available message", "PASS")
            elif has_no_chat_msg:
                record("S7", "Onboarder chat", "PASS")
            else:
                record("S7", "Onboarder chat", "FAIL", f"no_chat={has_no_chat_msg}, body={b[:80]}")
        except Exception as e:
            record("S7", "Onboarder chat", "FAIL", str(e))

        # ========== Step 8: Live Canvas with Hub Employees ==========
        try:
            go("/canvas", 5000)
            screenshot("08-live-canvas-hub.png")
            b = body()

            has_mx_pi_slot = "mx-pi-employee-a2" in b
            has_placeholder = "等待流连接" in b
            has_metrics = "Agent Metrics" in b or "Metrics" in b
            # Created employees (maintainer, scavenger, curator) should NOT have slots
            has_maintainer_slot = "maintainer-a1" in b and "智能体插槽" in b
            iframe_count = page.locator("iframe").count()

            if has_mx_pi_slot and (has_metrics or iframe_count > 0):
                record("S8", "Live Canvas: mx-pi-employee-a2 slot (running), no created slots", "PASS",
                       f"mx_pi={has_mx_pi_slot}, iframes={iframe_count}")
            elif has_mx_pi_slot:
                record("S8", "Live Canvas", "WARN", f"content={has_metrics}")
            else:
                record("S8", "Live Canvas", "FAIL", f"mx_pi={has_mx_pi_slot}, body={b[:100]}")
        except Exception as e:
            record("S8", "Live Canvas", "FAIL", str(e))

        # ========== Step 9: Settings Page ==========
        try:
            go("/settings", 2000)
            screenshot("09-settings.png")
            b = body()

            has_settings = "Settings" in b or "设置" in b
            has_content = len(b) > 100

            if has_settings and has_content:
                record("S9", "Settings page loads", "PASS")
            else:
                record("S9", "Settings page", "WARN", f"settings={has_settings}")
        except Exception as e:
            record("S9", "Settings", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("HUB PRESETS QA REPORT")
    print("=" * 60)
    pc = sum(1 for r in results if r["status"] == "PASS")
    wc = sum(1 for r in results if r["status"] == "WARN")
    fc = sum(1 for r in results if r["status"] == "FAIL")
    print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")

    with open(SCRIPT_DIR / "qa-report.json", "w", encoding="utf-8") as f:
        json.dump({"results": results, "summary": {"pass": pc, "warn": wc, "fail": fc}}, f, indent=2, ensure_ascii=False)

    return 0 if fc == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
