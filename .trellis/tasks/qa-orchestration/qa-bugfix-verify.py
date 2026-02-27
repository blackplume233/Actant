"""Verify Orchestration Wizard bug fix: visible hints when Next disabled
URL: http://localhost:5210/orchestration/create
Checks: 1) Step 1 no archetype - red hint + error, 2) After select - hint gone, 3) Step 2 empty - touched error,
4) Invalid name format error, 5) Valid input clears errors, 6) Next works after fix
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
SCREENSHOT_DIR = SCRIPT_DIR / "screenshots" / "bugfix"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

results = []


def record(check_id, desc, status, detail=""):
    results.append({"id": check_id, "desc": desc, "status": status, "detail": detail})
    icon = "PASS" if status == "PASS" else "FAIL"
    print(f"[{icon}] {check_id}: {desc} - {detail[:100] if detail else ''}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def go(path, wait=2000):
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        # ========== Check 1: Step 1 — No archetype selected ==========
        try:
            go("/orchestration/create")
            page.wait_for_timeout(1500)
            screenshot("01-step1-no-archetype.png")
            body = page.inner_text("body")
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_disabled = next_btn.count() > 0 and next_btn.is_disabled()
            has_hint = "请完成必填项" in body
            has_archetype_err = "请选择至少一个原型" in body or "请至少选择" in body or "Select at least" in body
            if next_disabled and has_hint and has_archetype_err:
                record("C1", "Step 1 no archetype: Next disabled, 请完成必填项, 请选择至少一个原型", "PASS", "")
            else:
                record("C1", "Step 1 no archetype", "FAIL",
                       f"next_disabled={next_disabled}, hint={has_hint}, archetype_err={has_archetype_err}")
        except Exception as e:
            record("C1", "Step 1 no archetype", "FAIL", str(e))

        # ========== Check 2: Step 1 — After selecting archetype ==========
        try:
            svc_card = page.locator("text=服务").first
            if svc_card.count() > 0:
                svc_card.click()
                page.wait_for_timeout(800)
            screenshot("02-step1-after-select.png")
            body = page.inner_text("body")
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_enabled = next_btn.count() > 0 and not next_btn.is_disabled()
            hint_gone = "请完成必填项" not in body
            if next_enabled and hint_gone:
                record("C2", "Step 1 after select: hint gone, Next enabled", "PASS", "")
            else:
                record("C2", "Step 1 after select", "FAIL", f"next_enabled={next_enabled}, hint_gone={hint_gone}")
        except Exception as e:
            record("C2", "Step 1 after select", "FAIL", str(e))

        # ========== Check 3: Step 2 — Empty fields show errors after interaction ==========
        try:
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            screenshot("03-step2-empty.png")
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.click()
                page.wait_for_timeout(200)
                name_in.fill("a")
                page.wait_for_timeout(200)
                name_in.fill("")
                page.wait_for_timeout(500)
            screenshot("04-step2-name-touched-empty.png")
            body = page.inner_text("body")
            has_name_err = "名称为必填项" in body or "名称" in body and "必填" in body or "Name is required" in body
            has_hint = "请完成必填项" in body
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_disabled = next_btn.count() > 0 and next_btn.is_disabled()
            if has_name_err and has_hint and next_disabled:
                record("C3", "Step 2 empty after touch: Name error, 请完成必填项, Next disabled", "PASS", "")
            else:
                record("C3", "Step 2 empty after touch", "FAIL",
                       f"name_err={has_name_err}, hint={has_hint}, next_disabled={next_disabled}")
        except Exception as e:
            record("C3", "Step 2 empty after touch", "FAIL", str(e))

        # ========== Check 4: Step 2 — Invalid name format ==========
        try:
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("INVALID SPACES")
                page.wait_for_timeout(500)
            screenshot("05-step2-invalid-name.png")
            body = page.inner_text("body")
            has_format_err = "格式" in body or "format" in body.lower() or "小写" in body or "lowercase" in body.lower() or "连字符" in body
            if has_format_err:
                record("C4", "Step 2 invalid name: format validation error", "PASS", "")
            else:
                record("C4", "Step 2 invalid name", "FAIL", f"format_err={has_format_err}")
        except Exception as e:
            record("C4", "Step 2 invalid name", "FAIL", str(e))

        # ========== Check 5: Step 2 — Valid input clears errors ==========
        try:
            name_in = page.locator("input[placeholder='my-agent-template']").first
            if name_in.count() > 0:
                name_in.fill("")
                page.wait_for_timeout(200)
                name_in.fill("valid-name")
                page.wait_for_timeout(200)
            desc_in = page.locator("input[placeholder*='brief'], input[placeholder*='description'], input[placeholder*='描述']").first
            if desc_in.count() == 0:
                desc_in = page.locator("input").nth(1)
            if desc_in.count() > 0:
                desc_in.fill("A test description")
                page.wait_for_timeout(500)
            screenshot("06-step2-valid.png")
            body = page.inner_text("body")
            hint_gone = "请完成必填项" not in body
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            next_enabled = next_btn.count() > 0 and not next_btn.is_disabled()
            # Error msgs: 名称为必填项, 名称只能包含 (format); avoid matching 格式 in field hints
            no_err = "名称为必填项" not in body and "名称只能包含" not in body
            if hint_gone and next_enabled and no_err:
                record("C5", "Step 2 valid: errors gone, hint gone, Next enabled", "PASS", "")
            else:
                record("C5", "Step 2 valid input", "FAIL", f"hint_gone={hint_gone}, next_enabled={next_enabled}, no_err={no_err}")
        except Exception as e:
            record("C5", "Step 2 valid input", "FAIL", str(e))

        # ========== Check 6: Next works after fixing ==========
        try:
            next_btn = page.locator("button:has-text('Next'), button:has-text('下一步')").first
            if next_btn.count() > 0 and not next_btn.is_disabled():
                next_btn.click()
                page.wait_for_timeout(1500)
            body = page.inner_text("body")
            has_skills = "可用技能" in body or "Available Skills" in body or "技能选配" in body
            if has_skills:
                record("C6", "Next works: navigated to Step 3 (Skills)", "PASS", "")
            else:
                record("C6", "Next to Step 3", "FAIL", f"skills_step={has_skills}")
        except Exception as e:
            record("C6", "Next to Step 3", "FAIL", str(e))

        browser.close()

    # Report
    report_path = SCRIPT_DIR / "QA-BUGFIX-REPORT.md"
    pass_count = sum(1 for r in results if r["status"] == "PASS")
    fail_count = sum(1 for r in results if r["status"] == "FAIL")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Orchestration Wizard Bug Fix Verification\n\n")
        f.write(f"**URL:** {BASE}/orchestration/create\n\n")
        f.write("## Summary\n\n")
        f.write(f"- **PASS:** {pass_count}\n")
        f.write(f"- **FAIL:** {fail_count}\n\n")
        f.write("## Results\n\n")
        for r in results:
            f.write(f"### {r['id']}: {r['desc']}\n\n")
            f.write(f"- **Status:** {r['status']}\n")
            if r["detail"]:
                f.write(f"- **Detail:** {r['detail']}\n")
            f.write("\n")

    print(f"\nReport: {report_path}")
    print(f"Screenshots: {SCREENSHOT_DIR}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
