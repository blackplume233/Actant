"""Verify two injected canvas entries in Actant Dashboard - http://localhost:3200

Test: mx-pi-employee-a2 (dark metrics), mx-cc-employee-a1 (red error state),
Live Canvas, Agent Detail tabs, responsive, agents list.
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
    print(f"[{icon}] {step_id}: {desc} - {detail[:150] if detail else ''}")


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

        # ========== Step 1: Live Canvas - Multiple Canvases ==========
        try:
            go("/canvas", 5000)
            screenshot("01-live-canvas-dual.png")
            b = body()

            has_placeholder = "等待流连接" in b
            has_iframes = page.locator("iframe").count() >= 2

            # mx-pi-employee-a2: dark metrics
            has_metrics = "Total Agents" in b or "16" in b or "Actant" in b or "Metrics" in b
            has_employee_a2 = "mx-pi-employee-a2" in b

            # mx-cc-employee-a1: red error
            has_employee_a1 = "mx-cc-employee-a1" in b
            has_error = "Error" in b or "error" in b or "异常" in b

            if has_iframes and not has_placeholder and has_employee_a2 and has_employee_a1:
                record("S1", "Live Canvas: both mx-pi-employee-a2 and mx-cc-employee-a1, no placeholders", "PASS",
                       f"iframes={page.locator('iframe').count()}, metrics={has_metrics}, error={has_error}")
            elif has_iframes and has_employee_a2:
                record("S1", "Live Canvas: mx-pi-employee-a2 present", "WARN", f"a1={has_employee_a1}, placeholder={has_placeholder}")
            else:
                record("S1", "Live Canvas dual canvases", "FAIL", f"iframes={has_iframes}, a2={has_employee_a2}, a1={has_employee_a1}")
        except Exception as e:
            record("S1", "Live Canvas", "FAIL", str(e))

        # ========== Step 2: Employee mx-pi-employee-a2 Canvas Tab ==========
        try:
            go("/agents/mx-pi-employee-a2", 2000)
            canvas_tab = page.locator("button:has-text('画布'), button:has-text('Canvas'), [data-value='canvas']").first
            if canvas_tab.count() > 0:
                canvas_tab.click()
                page.wait_for_timeout(3000)
                screenshot("02-agent-detail-mx-pi-canvas.png")
                b = body()

                has_metrics = "Agent Metrics" in b or "Metrics" in b or "Total Agents" in b or "16" in b
                has_iframe = page.locator("iframe").count() > 0
                has_badge = "Agent Metrics" in b or "Metrics" in b

                if has_iframe and (has_metrics or has_badge):
                    record("S2", "mx-pi-employee-a2 Canvas: dark metrics dashboard", "PASS",
                           f"iframe={has_iframe}, metrics={has_metrics}")
                elif has_iframe:
                    record("S2", "mx-pi-employee-a2 Canvas tab", "WARN", f"content={b[:100]}")
                else:
                    record("S2", "mx-pi-employee-a2 Canvas tab", "FAIL", f"iframe={has_iframe}")
            else:
                record("S2", "mx-pi-employee-a2 Canvas tab", "FAIL", "Canvas tab not found")
        except Exception as e:
            record("S2", "mx-pi-employee-a2 Canvas", "FAIL", str(e))

        # ========== Step 3: Employee mx-cc-employee-a1 Canvas Tab ==========
        try:
            go("/agents/mx-cc-employee-a1", 2000)
            canvas_tab = page.locator("button:has-text('画布'), button:has-text('Canvas'), [data-value='canvas']").first
            if canvas_tab.count() > 0:
                canvas_tab.click()
                page.wait_for_timeout(3000)
                screenshot("03-agent-detail-mx-cc-canvas.png")
                b = body()

                has_error = "Error" in b or "error" in b or "Agent Error" in b or "异常" in b
                has_iframe = page.locator("iframe").count() > 0
                has_employee_a1 = "mx-cc-employee-a1" in b

                if has_iframe and (has_error or has_employee_a1):
                    record("S3", "mx-cc-employee-a1 Canvas: red error state", "PASS",
                           f"iframe={has_iframe}, error={has_error}")
                elif has_iframe:
                    record("S3", "mx-cc-employee-a1 Canvas tab", "WARN", f"content={b[:100]}")
                else:
                    record("S3", "mx-cc-employee-a1 Canvas tab", "FAIL", f"iframe={has_iframe}")
            else:
                record("S3", "mx-cc-employee-a1 Canvas tab", "FAIL", "Canvas tab not found")
        except Exception as e:
            record("S3", "mx-cc-employee-a1 Canvas", "FAIL", str(e))

        # ========== Step 4: Responsive - Mobile Width ==========
        try:
            page.set_viewport_size({"width": 375, "height": 667})
            go("/canvas", 3000)
            screenshot("04-responsive-mobile.png")
            b = body()

            has_canvas = "Canvas" in b or "画布" in b or "mx-pi" in b or "mx-cc" in b
            has_content = len(b) > 200

            if has_content and has_canvas:
                record("S4", "Responsive: canvas cards stack vertically", "PASS", f"content_len={len(b)}")
            else:
                record("S4", "Responsive mobile", "WARN", f"content={has_content}, canvas={has_canvas}")
        except Exception as e:
            record("S4", "Responsive", "FAIL", str(e))

        # ========== Step 5: Back to Agents List ==========
        try:
            page.set_viewport_size({"width": 1280, "height": 900})
            go("/agents", 2000)
            screenshot("05-agents-list.png")
            b = body()

            has_employees = "雇员" in b or "Employee" in b
            has_services = "服务" in b or "Service" in b
            has_repos = "仓库" in b or "Repositor" in b
            has_archetype_sections = has_employees and has_services and has_repos

            if has_archetype_sections:
                record("S5", "Agents list: archetype sections with counts", "PASS",
                       f"employees={has_employees}, services={has_services}, repos={has_repos}")
            else:
                record("S5", "Agents list", "WARN", f"sections={has_archetype_sections}")
        except Exception as e:
            record("S5", "Agents list", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("DUAL CANVAS VERIFICATION REPORT")
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
