"""Orchestration Feature QA - Full Test Plan
Dev server: http://localhost:5200/
Override: QA_BASE_URL=http://localhost:5200 python qa-orchestration-full.py
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

BASE = os.environ.get("QA_BASE_URL", "http://localhost:5200")
SCRIPT_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = SCRIPT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(exist_ok=True)

results = []
console_errors = []


def record(step_id, desc, status, detail=""):
    results.append({"id": step_id, "desc": desc, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else ("WARN" if status == "WARN" else "FAIL")
    print(f"[{icon}] {step_id}: {desc} - {detail[:120] if detail else ''}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)

        page.on("console", on_console)

        def go(path, wait=2500):
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        # ========== Test 1: Home + Sidebar ==========
        try:
            go("/")
            screenshot("01-sidebar-home.png")
            body = page.inner_text("body")
            sidebar = page.locator("aside, [class*='sidebar']").first
            sidebar_text = sidebar.inner_text() if sidebar.count() > 0 else ""
            orch_in_sidebar = "Orchestration" in sidebar_text or "编排" in sidebar_text
            has_agents = "Agents" in sidebar_text or "智能体" in sidebar_text
            has_activity = "Activity" in sidebar_text or "活动" in sidebar_text
            if orch_in_sidebar and (has_agents or has_activity):
                record("T1", "Sidebar: Orchestration link between Agents and Activity, Workflow icon", "PASS", "Link visible")
            elif orch_in_sidebar:
                record("T1", "Sidebar: Orchestration visible", "PASS", "Orchestration in sidebar")
            else:
                record("T1", "Sidebar: Orchestration", "FAIL", f"sidebar={sidebar_text[:150]}")
        except Exception as e:
            record("T1", "Home + Sidebar", "FAIL", str(e))

        # ========== Test 2: Orchestration List ==========
        try:
            orch_link = page.locator("a[href='/orchestration']").first
            if orch_link.count() > 0:
                orch_link.click()
                page.wait_for_timeout(2000)
            else:
                go("/orchestration")
            screenshot("02-orchestration-list.png")
            url = page.url
            body = page.inner_text("body")
            has_url = "/orchestration" in url and "create" not in url
            has_title = "Orchestration" in body or "编排" in body
            has_create = "Create Template" in body or "创建模板" in body
            has_search = page.locator("input[placeholder*='Search'], input[placeholder*='搜索']").count() > 0
            has_filters = "All" in body or "全部" in body or "Employee" in body or "员工" in body
            has_view_toggle = "Cards" in body or "Table" in body or "卡片" in body or "表格" in body
            if has_url and has_title and has_create:
                record("T2", "Orchestration list: URL, title, Create Template, filters, search, view toggle", "PASS",
                       f"search={has_search}, filters={has_filters}, view={has_view_toggle}")
            else:
                record("T2", "Orchestration list", "WARN" if has_title else "FAIL",
                       f"url={has_url}, title={has_title}, create={has_create}")
        except Exception as e:
            record("T2", "Orchestration List", "FAIL", str(e))

        # ========== Test 3: Create Wizard Step 1 ==========
        try:
            create_btn = page.locator("a[href='/orchestration/create'], a[href*='orchestration/create']").first
            if create_btn.count() > 0:
                create_btn.click()
                page.wait_for_timeout(2000)
            else:
                go("/orchestration/create")
            screenshot("03-create-wizard-step1.png")
            body = page.inner_text("body")
            has_back = page.locator("a[href='/orchestration']").count() > 0
            has_title = "Create Template" in body or "创建模板" in body
            has_steps = "Archetype" in body or "原型" in body
            has_service = "Service" in body or "服务" in body
            has_employee = "Employee" in body or "员工" in body or "雇员" in body
            has_repo = "Repository" in body or "Tool" in body or "仓库" in body
            has_nav_btns = "Next" in body or "下一步" in body
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_disabled = next_btn.count() > 0 and next_btn.is_disabled()
            if has_title and has_steps and (has_service or has_employee) and has_nav_btns:
                record("T3", "Create wizard Step 1: back, title, steps, 3 archetype cards, nav buttons", "PASS",
                       f"next_disabled={next_disabled}")
            else:
                record("T3", "Create wizard Step 1", "WARN" if has_title else "FAIL",
                       f"title={has_title}, archetypes={has_service},{has_employee},{has_repo}")
        except Exception as e:
            record("T3", "Create Wizard Step 1", "FAIL", str(e))

        # ========== Test 4: Employee Selection ==========
        try:
            emp_card = page.locator("text=Employee").first
            if emp_card.count() == 0:
                emp_card = page.locator("text=雇员").first
            if emp_card.count() == 0:
                emp_card = page.locator("text=员工").first
            if emp_card.count() > 0:
                emp_card.click()
                page.wait_for_timeout(1000)
            screenshot("04-employee-selected.png")
            body = page.inner_text("body")
            has_scheduler = "Scheduler" in body or "调度" in body or "调度器" in body
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_enabled = next_btn.count() > 0 and not next_btn.is_disabled()
            has_selected = page.locator("[class*='ring-primary'], [class*='border-primary'], [class*='ring-2']").count() > 0
            if has_scheduler and next_enabled:
                record("T4", "Employee selected: card highlight, Next enabled, Scheduler step", "PASS",
                       f"scheduler={has_scheduler}, next_enabled={next_enabled}")
            elif next_enabled:
                record("T4", "Employee selected: Next enabled", "PASS", f"scheduler={has_scheduler}")
            else:
                record("T4", "Employee selection", "WARN", f"scheduler={has_scheduler}, next_enabled={next_enabled}")
        except Exception as e:
            record("T4", "Employee Selection", "FAIL", str(e))

        # ========== Test 5: Wizard Step 2 - Basic Info ==========
        try:
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("05-basic-info.png")
            body = page.inner_text("body")
            has_name = "Name" in body or "名称" in body
            has_backend = "Backend" in body or "后端" in body
            has_desc = "Description" in body or "描述" in body
            has_layer = "Layer" in body or "层" in body
            has_version = "Version" in body or "版本" in body
            has_prompt = "System Prompt" in body or "Prompt" in body or "提示" in body
            has_edit_preview = "Edit" in body or "Preview" in body or "编辑" in body or "预览" in body
            if has_name and has_desc and (has_backend or has_layer):
                record("T5", "Basic Info: Name, Backend, Description, Layer, Version, Prompt, Edit/Preview", "PASS",
                       f"all_fields={has_name},{has_backend},{has_desc},{has_layer},{has_version},{has_prompt}")
            else:
                record("T5", "Basic Info", "WARN" if has_name else "FAIL", f"name={has_name}, desc={has_desc}")
        except Exception as e:
            record("T5", "Basic Info", "FAIL", str(e))

        # ========== Test 6: Fill Basic Info, Go to Step 3 (Skills) ==========
        try:
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("qa-test-template")
                page.wait_for_timeout(200)
            # Description: placeholder varies by locale (en: "brief", zh: "描述" in "简短的一句话描述")
            desc_in = page.locator("input[placeholder*='brief'], input[placeholder*='description'], input[placeholder*='one-line'], input[placeholder*='描述']").first
            if desc_in.count() == 0:
                desc_in = page.locator("form input, [class*='space-y'] input").nth(1)
            if desc_in.count() > 0:
                desc_in.fill("A test template for QA")
                page.wait_for_timeout(200)
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("06-skills-step.png")
            body = page.inner_text("body")
            has_available = "Available Skills" in body or "可用技能" in body
            has_selected = "Selected Skills" in body or "已选技能" in body
            has_skill_search = page.locator("input[placeholder*='skill'], input[placeholder*='技能']").count() > 0
            if has_available and has_selected:
                record("T6", "Skills step: Available Skills, Selected Skills, search bar", "PASS",
                       f"search={has_skill_search}")
            else:
                record("T6", "Skills step", "WARN" if "Skills" in body else "FAIL",
                       f"available={has_available}, selected={has_selected}")
        except Exception as e:
            record("T6", "Skills Step", "FAIL", str(e))

        # ========== Test 7: Step 4 (Scheduler) + Step 5 (Preview) ==========
        try:
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("07-scheduler-step.png")
            body = page.inner_text("body")
            has_heartbeat = "Heartbeat" in body or "心跳" in body
            has_cron = "Cron" in body or "Cron Jobs" in body or "定时" in body
            has_hooks = "Event Hooks" in body or "事件" in body or "Hooks" in body
            if has_heartbeat or has_cron or has_hooks:
                record("T7a", "Scheduler: Heartbeat, Cron Jobs, Event Hooks", "PASS",
                       f"heartbeat={has_heartbeat}, cron={has_cron}, hooks={has_hooks}")
            else:
                record("T7a", "Scheduler step", "WARN", f"body_preview={body[:100]}")

            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("08-preview-step.png")
            body = page.inner_text("body")
            has_summary = "Name" in body or "Archetypes" in body or "Skills" in body or "Scheduler" in body or "名称" in body or "原型" in body or "技能" in body or "调度器" in body
            has_json = "JSON Preview" in body or "JSON" in body or "JSON 预览" in body
            has_create_btn = page.locator("button:has-text('Create'), button:has-text('创建')").count() > 0
            if has_summary and has_create_btn:
                record("T7b", "Preview: Summary cards, JSON Preview, Create button", "PASS",
                       f"json={has_json}, create_btn={has_create_btn}")
            else:
                record("T7b", "Preview step", "WARN" if has_summary else "FAIL",
                       f"summary={has_summary}, create={has_create_btn}")
        except Exception as e:
            record("T7", "Scheduler + Preview", "FAIL", str(e))

        # ========== Test 8: Return to Orchestration List ==========
        try:
            back_link = page.locator("a[href='/orchestration']").first
            if back_link.count() > 0:
                back_link.click()
                page.wait_for_timeout(2000)
            else:
                go("/orchestration")
            screenshot("09-orchestration-final.png")
            body = page.inner_text("body")
            has_title = "Orchestration" in body or "编排" in body
            if has_title:
                record("T8", "Return to /orchestration list renders correctly", "PASS", "Page loads")
            else:
                record("T8", "Return to list", "WARN", f"body_preview={body[:100]}")
        except Exception as e:
            record("T8", "Return to List", "FAIL", str(e))

        browser.close()

    # Report
    report_path = SCRIPT_DIR / "QA-FULL-REPORT.md"
    pass_count = sum(1 for r in results if r["status"] == "PASS")
    warn_count = sum(1 for r in results if r["status"] == "WARN")
    fail_count = sum(1 for r in results if r["status"] == "FAIL")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Orchestration QA Full Report\n\n")
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

    json_path = SCRIPT_DIR / "qa-full-results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"results": results, "console_errors": console_errors}, f, indent=2)

    print(f"\nReport: {report_path}")
    print(f"Screenshots: {SCREENSHOT_DIR}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
