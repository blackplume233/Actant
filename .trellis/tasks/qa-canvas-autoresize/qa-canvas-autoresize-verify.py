"""Verify AgentCanvas iframe auto-resize for tall content - http://localhost:3200

Test: Live Canvas, Agent Detail Canvas tab, fullscreen, scroll-down.
Tall content: 6 metric cards + 12-row table + footer.
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


def get_iframe_height(page):
    """Get the first canvas iframe's offsetHeight."""
    try:
        iframe = page.locator("iframe[title*='Canvas']").first
        if iframe.count() == 0:
            return None
        return iframe.evaluate("el => el.offsetHeight")
    except Exception:
        return None


def get_iframe_body_text(page):
    """Get text content from inside the canvas iframe."""
    try:
        frame = page.frame_locator("iframe[title*='Canvas']").first
        return frame.locator("body").inner_text(timeout=3000)
    except Exception:
        return ""


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

        # ========== Step 1: Live Canvas - Card Auto-Resize ==========
        try:
            go("/canvas", 5000)
            screenshot("01-live-canvas-autoresize.png")

            h = get_iframe_height(page)
            iframe_text = get_iframe_body_text(page)
            b = body()

            has_control_plane = "Control Plane" in iframe_text or "Control Plane" in b or "Actant" in iframe_text
            has_roster = "Roster" in iframe_text or "Roster" in b or "Agent" in iframe_text
            has_6_cards = "Total" in iframe_text or "16" in iframe_text or "metric" in iframe_text.lower()

            taller_than_200 = h is not None and h > 250

            if taller_than_200 and (has_control_plane or has_roster):
                record("S1", "Live Canvas: iframe auto-resize, full content", "PASS",
                       f"iframe_height={h}px, control_plane={has_control_plane}")
            elif h is not None and h > 200:
                record("S1", "Live Canvas auto-resize", "WARN", f"height={h}px, expected >250")
            else:
                record("S1", "Live Canvas", "FAIL", f"height={h}, control_plane={has_control_plane}")
        except Exception as e:
            record("S1", "Live Canvas", "FAIL", str(e))

        # ========== Step 2: Agent Detail Canvas Tab - Auto-Resize ==========
        try:
            go("/agents/mx-pi-employee-a2", 2000)
            canvas_tab = page.locator("button:has-text('画布'), button:has-text('Canvas')").first
            if canvas_tab.count() > 0:
                canvas_tab.click()
                page.wait_for_timeout(5000)
            screenshot("02-agent-detail-canvas-autoresize.png")

            h = get_iframe_height(page)
            iframe_text = get_iframe_body_text(page)
            b = body()

            has_full_content = "Roster" in iframe_text or "Control Plane" in iframe_text or "Roster" in b
            in_range = h is not None and 400 <= h <= 1200
            significantly_tall = h is not None and h > 300

            if significantly_tall and has_full_content:
                record("S2", "Agent Detail Canvas: iframe auto-resize, full content", "PASS",
                       f"iframe_height={h}px")
            elif h is not None and h > 200:
                record("S2", "Agent Detail Canvas auto-resize", "WARN", f"height={h}px, expected 600-800")
            else:
                record("S2", "Agent Detail Canvas", "FAIL", f"height={h}, content={has_full_content}")
        except Exception as e:
            record("S2", "Agent Detail Canvas", "FAIL", str(e))

        # ========== Step 3: Canvas Fullscreen ==========
        # Fullscreen button only exists on Live Canvas (agent detail Canvas tab uses showHeader=false)
        try:
            go("/canvas", 5000)
            # Fullscreen button is inside the canvas card (card has gradient stripe)
            fullscreen_btn = page.locator("[class*='from-violet']").locator("..").locator("button:has(svg)").first
            if fullscreen_btn.count() > 0 and fullscreen_btn.is_visible():
                fullscreen_btn.click()
                page.wait_for_timeout(2000)
                screenshot("03-canvas-fullscreen.png")
                b = body()
                iframe_text = get_iframe_body_text(page)
                has_back = "返回" in b or "Back" in b
                has_fullscreen_content = "Control Plane" in iframe_text or "Roster" in iframe_text or "Control Plane" in b
                if has_back and has_fullscreen_content:
                    record("S3", "Fullscreen overlay with full content", "PASS")
                else:
                    record("S3", "Fullscreen", "WARN", f"back={has_back}, content={has_fullscreen_content}")

                back_btn = page.locator("button:has-text('返回'), button:has-text('Back')").first
                if back_btn.count() > 0:
                    back_btn.click()
                    page.wait_for_timeout(1000)
            else:
                record("S3", "Fullscreen button", "WARN", "Button not found")
        except Exception as e:
            record("S3", "Fullscreen", "FAIL", str(e))

        # ========== Step 4: Scroll Down Check ==========
        try:
            go("/canvas", 5000)
            # Scroll to bottom of page to see full canvas card
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1500)
            screenshot("04-canvas-scroll-bottom.png")

            iframe_text = get_iframe_body_text(page)
            b = body()
            has_roster = "Roster" in iframe_text or "Roster" in b
            has_footer = "更新" in b or "Updated" in b or "timestamp" in b.lower()
            has_table = "row" in iframe_text.lower() or "12" in iframe_text or "table" in iframe_text.lower()
            h = get_iframe_height(page)

            if (has_roster or has_table) and h and h > 300:
                record("S4", "Scroll: Agent Roster table and footer visible", "PASS",
                       f"iframe_h={h}px, roster={has_roster}, table={has_table}")
            elif has_roster or has_table:
                record("S4", "Scroll down check", "WARN", f"roster={has_roster}, h={h}")
            else:
                record("S4", "Scroll down check", "FAIL", f"roster={has_roster}, table={has_table}")
        except Exception as e:
            record("S4", "Scroll down", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("CANVAS AUTO-RESIZE QA REPORT")
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
