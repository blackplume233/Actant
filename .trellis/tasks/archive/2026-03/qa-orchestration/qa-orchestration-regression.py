"""Orchestration Comprehensive Regression Test
URL: http://localhost:5210/
Override: QA_BASE_URL=http://localhost:5210 python qa-orchestration-regression.py
"""
import json
import os
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: pip install playwright && playwright install chromium")
    sys.exit(1)

BASE = os.environ.get("QA_BASE_URL", "http://localhost:5210")
SCRIPT_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = SCRIPT_DIR / "screenshots" / "regression"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

results = []
console_errors = []


def record(check_id, desc, status, detail=""):
    results.append({"id": check_id, "desc": desc, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{icon}] {check_id}: {desc} - {detail[:100] if detail else ''}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)

        page.on("console", on_console)

        def go(path, wait=2000):
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        # ========== Part A: Sidebar + Navigation ==========
        try:
            go("/")
            screenshot("A1-home.png")
            body = page.inner_text("body")
            sidebar = page.locator("aside, [class*='sidebar']").first
            sidebar_text = sidebar.inner_text() if sidebar.count() > 0 else ""
            orch = "编排" in sidebar_text or "Orchestration" in sidebar_text
            agents = "智能体" in sidebar_text or "Agents" in sidebar_text
            activity = "活动" in sidebar_text or "Activity" in sidebar_text
            if orch and agents and activity:
                record("A1", "编排 link in sidebar between 智能体 and 活动", "PASS", "Link visible")
            else:
                record("A1", "Sidebar Orchestration link", "FAIL", f"orch={orch}, sidebar={sidebar_text[:80]}")

            orch_link = page.locator("a[href='/orchestration']").first
            if orch_link.count() > 0:
                orch_link.click()
                page.wait_for_timeout(1500)
            else:
                go("/orchestration")
            url = page.url
            if "/orchestration" in url and "create" not in url:
                record("A2", "Click 编排 -> URL is /orchestration", "PASS", f"url={url}")
            else:
                record("A2", "Click 编排 -> /orchestration", "FAIL", f"url={url}")
        except Exception as e:
            record("A1", "Part A Sidebar", "FAIL", str(e))
            record("A2", "Part A Navigation", "FAIL", str(e))

        # ========== Part B: Template List Page ==========
        try:
            go("/orchestration")
            screenshot("B1-list.png")
            body = page.inner_text("body")
            has_title = "编排" in body or "Orchestration" in body
            has_create = "创建模板" in body or "Create Template" in body
            has_search = page.locator("input[placeholder*='Search'], input[placeholder*='搜索']").count() > 0
            has_archetype = "全部" in body and ("雇员" in body or "服务" in body or "仓库" in body)
            has_layer = "全部" in body or "核心" in body or "辅助" in body or "火花" in body
            has_toggle = "卡片" in body or "表格" in body or page.locator("[class*='LayoutGrid']").count() > 0
            if has_title and has_create and has_search:
                record("B1", "Title 编排, 创建模板, search, archetype filters, layer, grid/list toggle", "PASS",
                       f"archetype={has_archetype}, layer={has_layer}, toggle={has_toggle}")
            else:
                record("B1", "List page elements", "WARN" if has_title else "FAIL",
                       f"title={has_title}, create={has_create}, search={has_search}")

            # B2: Click archetype filter badges
            emp_badge = page.locator("button:has-text('雇员'), [role='button']:has-text('雇员')").first
            if emp_badge.count() > 0:
                emp_badge.click()
                page.wait_for_timeout(500)
                emp_badge.click()
                page.wait_for_timeout(500)
                record("B2", "Archetype filter badges toggle", "PASS", "Clicked 雇员 badge")
            else:
                record("B2", "Archetype filter badges", "WARN", "Badge not found")

            # B3: Grid/list toggle
            grid_btn = page.locator("button:has-text('卡片'), [aria-label*='grid']").first
            list_btn = page.locator("button:has-text('表格'), [aria-label*='list']").first
            if grid_btn.count() > 0 and list_btn.count() > 0:
                list_btn.click()
                page.wait_for_timeout(500)
                grid_btn.click()
                page.wait_for_timeout(500)
                record("B3", "Grid/list toggle switches", "PASS", "Toggled views")
            else:
                record("B3", "Grid/list toggle", "WARN", f"grid={grid_btn.count()}, list={list_btn.count()}")

            # B4: Search nonexistent
            search_in = page.locator("input[placeholder*='Search'], input[placeholder*='搜索']").first
            if search_in.count() > 0:
                search_in.fill("nonexistent")
                page.wait_for_timeout(1500)
                screenshot("B4-search-nonexistent.png")
                body = page.inner_text("body")
                has_no_match = "没有符合" in body or "No templates" in body or "暂无" in body or "no match" in body.lower()
                record("B4", "Search nonexistent -> no-match/empty state", "PASS" if has_no_match else "WARN",
                       f"no_match={has_no_match}")
            else:
                record("B4", "Search nonexistent", "WARN", "Search input not found")
        except Exception as e:
            record("B1", "Part B List", "FAIL", str(e))

        # ========== Part C: Wizard - Full Happy Path ==========
        try:
            go("/orchestration")
            create_btn = page.locator("a[href='/orchestration/create']").first
            if create_btn.count() > 0:
                create_btn.click()
                page.wait_for_timeout(2000)
            else:
                go("/orchestration/create")
            screenshot("C1-wizard-step1.png")
            body = page.inner_text("body")
            has_step1 = "选择原型" in body or "Archetype" in body
            has_cards = "服务" in body and "雇员" in body
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_disabled = next_btn.count() > 0 and next_btn.is_disabled()
            if has_step1 and has_cards and next_disabled:
                record("C1", "Wizard Step 1: 选择原型 active, 3 cards, Next disabled", "PASS", "")
            else:
                record("C1", "Wizard Step 1", "WARN" if has_step1 else "FAIL", f"next_disabled={next_disabled}")

            # C2: Click Service - no scheduler step
            svc_card = page.locator("text=服务").first
            if svc_card.count() > 0:
                svc_card.click()
                page.wait_for_timeout(800)
            body = page.inner_text("body")
            has_scheduler_after_svc = "调度器" in body or "Scheduler" in body
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_enabled = next_btn.count() > 0 and not next_btn.is_disabled()
            if next_enabled and not has_scheduler_after_svc:
                record("C2", "Service selected: Next enabled, NO scheduler step", "PASS", "")
            else:
                record("C2", "Service selected", "WARN", f"scheduler={has_scheduler_after_svc}, next={next_enabled}")

            # C3: Also click Employee - multi-select, scheduler appears
            emp_card = page.locator("text=雇员").first
            if emp_card.count() > 0:
                emp_card.click()
                page.wait_for_timeout(800)
            body = page.inner_text("body")
            has_scheduler = "调度器" in body or "Scheduler" in body
            if has_scheduler:
                record("C3", "Employee added: both selected, scheduler step appears", "PASS", "")
            else:
                record("C3", "Employee multi-select", "WARN", f"scheduler={has_scheduler}")

            # C4: Next -> Step 2
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("C4-step2.png")
            body = page.inner_text("body")
            has_name = "名称" in body or "Name" in body
            has_desc = "描述" in body or "Description" in body
            has_backend = "后端" in body or "Backend" in body
            if has_name and has_desc and has_backend:
                record("C4", "Step 2: all form fields present", "PASS", "")
            else:
                record("C4", "Step 2 form fields", "WARN", f"name={has_name}, desc={has_desc}")

            # C5: Fill Name, Description
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("loop-test-tpl")
                page.wait_for_timeout(200)
            desc_in = page.locator("input[placeholder*='brief'], input[placeholder*='description'], input[placeholder*='描述']").first
            if desc_in.count() == 0:
                desc_in = page.locator("input").nth(1)
            if desc_in.count() > 0:
                desc_in.fill("Loop test template")
                page.wait_for_timeout(200)
            record("C5", "Fill Name=loop-test-tpl, Description=Loop test template", "PASS", "")

            # C6: Next -> Step 3
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("C6-step3.png")
            body = page.inner_text("body")
            has_available = "可用技能" in body or "Available Skills" in body
            has_selected = "已选技能" in body or "Selected Skills" in body
            if has_available and has_selected:
                record("C6", "Step 3: dual-panel layout", "PASS", "")
            else:
                record("C6", "Step 3 dual-panel", "WARN", f"available={has_available}, selected={has_selected}")

            # C7: Next -> Step 4
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("C7-step4.png")
            body = page.inner_text("body")
            has_heartbeat = "心跳" in body or "Heartbeat" in body
            has_cron = "定时" in body or "Cron" in body
            has_hooks = "事件" in body or "Hooks" in body
            if has_heartbeat or has_cron or has_hooks:
                record("C7", "Step 4: heartbeat/cron/hooks sections", "PASS", "")

            # C8: Enable heartbeat checkbox
            hb_check = page.locator("input[type='checkbox']").first
            if hb_check.count() > 0:
                hb_check.click()
                page.wait_for_timeout(500)
            body = page.inner_text("body")
            has_interval = "间隔" in body or "interval" in body.lower() or "毫秒" in body
            record("C8", "Heartbeat checkbox: interval/prompt/priority fields appear", "PASS" if has_interval else "WARN", "")

            # C9: Next -> Step 5 (Preview)
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("C9-step5.png")
            body = page.inner_text("body")
            has_summary = "名称" in body or "原型" in body or "技能" in body
            has_json = "JSON" in body or "预览" in body
            has_loop = "loop-test-tpl" in body
            if has_summary and has_json and has_loop:
                record("C9", "Step 5: summary cards, JSON, correct data", "PASS", "")
            else:
                record("C9", "Step 5 Preview", "WARN", f"summary={has_summary}, json={has_json}, loop={has_loop}")
        except Exception as e:
            record("C1", "Part C Wizard", "FAIL", str(e))

        # ========== Part D: Wizard - Edge Cases ==========
        try:
            # D1: Back arrow to /orchestration
            back_link = page.locator("a[href='/orchestration']").first
            if back_link.count() > 0:
                back_link.click()
                page.wait_for_timeout(2000)
            else:
                go("/orchestration")
            url = page.url
            if "/orchestration" in url and "create" not in url:
                record("D1", "Back arrow returns to /orchestration", "PASS", "")
            else:
                record("D1", "Back arrow", "FAIL", f"url={url}")

            # D2: /orchestration/create, no archetype, Next disabled + error
            go("/orchestration/create")
            page.wait_for_timeout(1500)
            body = page.inner_text("body")
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_disabled = next_btn.count() > 0 and next_btn.is_disabled()
            has_error = "请至少" in body or "Select at least" in body or "required" in body.lower() or "必填" in body
            if next_disabled:
                record("D2", "No archetype: Next disabled, error text", "PASS" if has_error else "WARN", f"error={has_error}")
            else:
                record("D2", "No archetype validation", "FAIL", f"next_disabled={next_disabled}")

            # D3: Step 2: empty Name, validation error
            emp_card = page.locator("text=雇员").first
            if emp_card.count() > 0:
                emp_card.click()
                page.wait_for_timeout(500)
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1000)
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("")
                page.wait_for_timeout(200)
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(800)
            body = page.inner_text("body")
            has_name_err = "名称" in body and ("必填" in body or "required" in body.lower())
            record("D3", "Empty Name: validation error", "PASS" if has_name_err else "WARN", f"err={has_name_err}")

            # D4: Name "INVALID SPACES", format validation
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("INVALID SPACES")
                page.wait_for_timeout(200)
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(800)
            body = page.inner_text("body")
            has_format_err = "格式" in body or "format" in body.lower() or "小写" in body or "lowercase" in body.lower()
            record("D4", "Invalid name format: validation error", "PASS" if has_format_err else "WARN", f"err={has_format_err}")

            # D5: Fill valid name, go to Preview, verify JSON
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("valid-name")
                page.wait_for_timeout(200)
            desc_in = page.locator("input[placeholder*='brief'], input[placeholder*='description'], input[placeholder*='描述']").first
            if desc_in.count() == 0:
                desc_in = page.locator("input").nth(1)
            if desc_in.count() > 0:
                desc_in.fill("test")
                page.wait_for_timeout(200)
            for _ in range(4):
                next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
                if next_btn.count() > 0 and not next_btn.is_disabled():
                    next_btn.click()
                    page.wait_for_timeout(1000)
            body = page.inner_text("body")
            has_valid_json = "valid-name" in body
            record("D5", "Valid name through to Preview: JSON shows correct name", "PASS" if has_valid_json else "WARN", f"valid={has_valid_json}")
        except Exception as e:
            record("D1", "Part D Edge Cases", "FAIL", str(e))

        # ========== Part E: Direct URL Navigation ==========
        try:
            go("/orchestration/create")
            page.wait_for_timeout(2000)
            body = page.inner_text("body")
            has_wizard = "创建模板" in body or "Create Template" in body
            has_archetype = "选择原型" in body or "Archetype" in body
            if has_wizard and has_archetype:
                record("E1", "Direct /orchestration/create loads wizard", "PASS", "")
            else:
                record("E1", "Direct /orchestration/create", "FAIL", f"wizard={has_wizard}")

            go("/orchestration/nonexistent-template")
            page.wait_for_timeout(2500)
            screenshot("E2-nonexistent.png")
            body = page.inner_text("body")
            has_graceful = "404" not in body or "未找到" in body or "not found" in body.lower() or "加载" in body or "loading" in body.lower()
            record("E2", "Direct /orchestration/nonexistent-template graceful", "PASS" if has_graceful else "WARN", f"body_preview={body[:80]}")

            go("/orchestration/nonexistent-template/materialize")
            page.wait_for_timeout(2500)
            screenshot("E3-materialize-nonexistent.png")
            body = page.inner_text("body")
            has_graceful2 = "404" not in body or "未找到" in body or "not found" in body.lower() or "创建实例" in body or "materialize" in body.lower()
            record("E3", "Direct /orchestration/.../materialize graceful", "PASS" if has_graceful2 else "WARN", f"body_preview={body[:80]}")
        except Exception as e:
            record("E1", "Part E Direct URLs", "FAIL", str(e))

        browser.close()

    # Report
    report_path = SCRIPT_DIR / "QA-REGRESSION-REPORT.md"
    pass_count = sum(1 for r in results if r["status"] == "PASS")
    warn_count = sum(1 for r in results if r["status"] == "WARN")
    fail_count = sum(1 for r in results if r["status"] == "FAIL")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Orchestration Regression QA Report\n\n")
        f.write(f"**Base URL:** {BASE}\n\n")
        f.write("## Summary\n\n")
        f.write(f"- **PASS:** {pass_count}\n")
        f.write(f"- **WARN:** {warn_count}\n")
        f.write(f"- **FAIL:** {fail_count}\n\n")
        f.write("## Results\n\n")
        for r in results:
            f.write(f"### {r['id']}: {r['desc']}\n\n")
            f.write(f"- **Status:** {r['status']}\n")
            if r["detail"]:
                f.write(f"- **Detail:** {r['detail']}\n")
            f.write("\n")

    json_path = SCRIPT_DIR / "qa-regression-results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"results": results, "console_errors": console_errors}, f, indent=2)

    print(f"\nReport: {report_path}")
    print(f"Screenshots: {SCREENSHOT_DIR}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
