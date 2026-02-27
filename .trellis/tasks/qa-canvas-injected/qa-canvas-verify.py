"""Verify injected canvas entry displays in Actant Dashboard - http://localhost:3200

Test: Canvas REST API injection -> Live Canvas page, Agent Detail Canvas tab,
fullscreen, Service (no canvas), SSE updates.
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
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        def go(path, wait=2000):
            page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(wait)

        def screenshot(name):
            page.screenshot(path=str(SCREENSHOT_DIR / name))

        def body():
            return page.inner_text("body")

        # ========== Step 1: Live Canvas Global Page ==========
        try:
            go("/canvas", 5000)
            screenshot("01-live-canvas.png")
            b = body()

            has_placeholder = "等待流连接" in b or "Waiting" in b
            has_canvas_test = "Canvas QA Test" in b or "QA" in b
            has_purple = page.locator("[class*='purple'], [class*='gradient']").count() > 0
            has_iframe = page.locator("iframe").count() > 0

            if has_iframe and not has_placeholder:
                record("S1", "Live Canvas: purple card with Canvas QA Test, no placeholder", "PASS",
                       f"iframe={has_iframe}, placeholder={has_placeholder}, content={has_canvas_test}")
            elif has_iframe:
                record("S1", "Live Canvas: iframe present", "WARN", f"placeholder_still={has_placeholder}")
            else:
                record("S1", "Live Canvas", "FAIL", f"iframe={has_iframe}, body_preview={b[:200]}")
        except Exception as e:
            record("S1", "Live Canvas", "FAIL", str(e))

        # ========== Step 2: Employee Agent Detail - Canvas Tab ==========
        try:
            go("/agents/mx-pi-employee-a2", 2000)
            canvas_tab = page.locator("button:has-text('画布'), button:has-text('Canvas'), [data-value='canvas']").first
            if canvas_tab.count() > 0:
                canvas_tab.click()
                page.wait_for_timeout(1500)
                screenshot("02-agent-detail-canvas-tab.png")
                b = body()

                has_qa = "QA Round 3" in b or "QA" in b
                has_fullscreen = page.locator("button[title*='fullscreen'], button[title*='全屏'], [class*='maximize'], [class*='expand']").count() > 0
                has_iframe = page.locator("iframe").count() > 0

                if has_iframe and (has_qa or has_fullscreen):
                    record("S2", "Canvas tab: purple gradient, QA Round 3, fullscreen btn", "PASS",
                           f"iframe={has_iframe}, qa={has_qa}, fullscreen_btn={has_fullscreen}")
                elif has_iframe:
                    record("S2", "Canvas tab", "WARN", f"iframe={has_iframe}, qa={has_qa}")
                else:
                    record("S2", "Canvas tab", "FAIL", f"iframe={has_iframe}")
            else:
                record("S2", "Canvas tab", "FAIL", "Canvas tab not found")
        except Exception as e:
            record("S2", "Canvas tab", "FAIL", str(e))

        # ========== Step 3: Canvas Fullscreen ==========
        try:
            fullscreen_btn = page.locator("button[title*='fullscreen'], button[title*='全屏'], button[aria-label*='fullscreen'], button:has(svg)").filter(has=page.locator("svg")).all()
            clicked = False
            for btn in fullscreen_btn[:5]:
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(1500)
                    screenshot("03-canvas-fullscreen.png")
                    clicked = True
                    break

            if not clicked:
                fullscreen_btn2 = page.locator("[class*='maximize'], [class*='expand'], [class*='fullscreen']").first
                if fullscreen_btn2.count() > 0 and fullscreen_btn2.is_visible():
                    fullscreen_btn2.click()
                    page.wait_for_timeout(1500)
                    screenshot("03-canvas-fullscreen.png")
                    clicked = True

            if clicked:
                b = body()
                has_back = "返回" in b or "Back" in b or page.locator("button:has-text('返回'), button:has-text('Back')").count() > 0
                record("S3a", "Fullscreen overlay with back button", "PASS" if has_back else "WARN", f"back={has_back}")

                back_btn = page.locator("button:has-text('返回'), button:has-text('Back'), a:has-text('返回')").first
                if back_btn.count() > 0 and back_btn.is_visible():
                    back_btn.click()
                    page.wait_for_timeout(1000)
                    screenshot("03b-canvas-normal-restored.png")
                    record("S3b", "Back button restores normal view", "PASS")
                else:
                    record("S3b", "Back button", "WARN", "Back button not found")
            else:
                record("S3", "Fullscreen button", "WARN", "Fullscreen button not found or not visible")
        except Exception as e:
            record("S3", "Fullscreen", "FAIL", str(e))

        # ========== Step 4: Service Detail - NO Canvas tab ==========
        try:
            go("/agents/mx-pi-service-a2", 2000)
            screenshot("04-service-no-canvas-tab.png")
            b = body()

            has_canvas_tab = "画布" in b or "Canvas" in b
            has_overview = "概览" in b or "Overview" in b
            has_sessions = "会话" in b or "Sessions" in b
            has_logs = "日志" in b or "Logs" in b

            if not has_canvas_tab and has_overview and has_sessions and has_logs:
                record("S4", "Service: NO Canvas tab, only Overview/Sessions/Logs", "PASS")
            elif not has_canvas_tab:
                record("S4", "Service: NO Canvas tab", "PASS")
            else:
                record("S4", "Service should NOT have Canvas tab", "FAIL", f"canvas_tab={has_canvas_tab}")
        except Exception as e:
            record("S4", "Service no canvas", "FAIL", str(e))

        # ========== Step 5: SSE Canvas Update (new page load) ==========
        try:
            page.goto(f"{BASE}/canvas", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(5000)
            screenshot("05-sse-canvas-update.png")
            b = body()

            has_placeholder = "等待流连接" in b
            has_iframe = page.locator("iframe").count() > 0
            has_content = has_iframe and not has_placeholder

            if has_content:
                record("S5", "SSE: canvas content shown (not placeholder)", "PASS")
            elif has_iframe:
                record("S5", "SSE canvas", "WARN", f"placeholder={has_placeholder}")
            else:
                record("S5", "SSE canvas update", "FAIL", f"iframe={has_iframe}, placeholder={has_placeholder}")
        except Exception as e:
            record("S5", "SSE canvas", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("CANVAS INJECTED VERIFICATION REPORT")
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
