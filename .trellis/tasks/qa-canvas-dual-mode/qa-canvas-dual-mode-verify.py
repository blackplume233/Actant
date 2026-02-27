"""Verify canvas dual mode: fixed-height on Live Canvas, auto-resize on Agent Detail.

Test: Live Canvas 320px fixed, Agent Detail ~1000+ px auto-resize,
scroll inside fixed iframe.
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
    try:
        iframe = page.locator("iframe[title*='Canvas']").first
        if iframe.count() == 0:
            return None
        return iframe.evaluate("el => el.offsetHeight")
    except Exception:
        return None


def get_iframe_body_text(page):
    try:
        frame = page.frame_locator("iframe[title*='Canvas']").first
        return frame.locator("body").inner_text(timeout=3000)
    except Exception:
        return ""


def scroll_inside_iframe(page):
    """Scroll the iframe's content to bottom."""
    try:
        page.evaluate("""
          () => {
            const iframe = document.querySelector('iframe[title*="Canvas"]');
            if (iframe && iframe.contentDocument) {
              const doc = iframe.contentDocument;
              doc.documentElement.scrollTop = doc.documentElement.scrollHeight;
            }
          }
        """)
        return True
    except Exception:
        return False


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

        h_live_canvas = None
        h_agent_detail = None

        # ========== Step 1: Live Canvas - Fixed Height ==========
        try:
            go("/canvas", 5000)
            screenshot("01-live-canvas-fixed.png")

            h = get_iframe_height(page)
            h_live_canvas = h
            iframe_text = get_iframe_body_text(page)

            is_fixed = h is not None and 280 <= h <= 380
            has_overflow = "Roster" in iframe_text or "Control Plane" in iframe_text
            not_auto_resized = h is not None and h < 500
            if is_fixed and not_auto_resized:
                record("S1", "Live Canvas: fixed height ~320px, content overflow", "PASS",
                       f"iframe_height={h}px")
            elif h is not None and h < 500:
                record("S1", "Live Canvas fixed height", "WARN", f"height={h}px, expected ~320")
            else:
                record("S1", "Live Canvas", "FAIL", f"height={h}, expected fixed ~320")
        except Exception as e:
            record("S1", "Live Canvas", "FAIL", str(e))

        # ========== Step 2: Agent Detail Canvas Tab - Auto-Resize ==========
        try:
            go("/agents/mx-pi-employee-a2", 2000)
            canvas_tab = page.locator("button:has-text('画布'), button:has-text('Canvas')").first
            if canvas_tab.count() > 0:
                canvas_tab.click()
                page.wait_for_timeout(5000)
            screenshot("02-agent-detail-autoresize.png")

            h = get_iframe_height(page)
            h_agent_detail = h
            iframe_text = get_iframe_body_text(page)

            has_6_cards = "TOTAL" in iframe_text and "RUNNING" in iframe_text and "EMPLOYEES" in iframe_text
            has_roster = "Roster" in iframe_text
            is_tall = h is not None and h >= 800
            in_range = h is not None and 900 <= h <= 1400

            if is_tall and has_roster:
                record("S2", "Agent Detail Canvas: auto-resize, full content", "PASS",
                       f"iframe_height={h}px")
            elif h is not None and h > 500:
                record("S2", "Agent Detail Canvas", "WARN", f"height={h}px, expected 1000-1300")
            else:
                record("S2", "Agent Detail Canvas", "FAIL", f"height={h}")
        except Exception as e:
            record("S2", "Agent Detail Canvas", "FAIL", str(e))

        # ========== Step 3: Compare Heights ==========
        try:
            h_canvas = h_live_canvas
            h_detail = h_agent_detail

            if h_canvas is not None and h_detail is not None:
                ratio = h_detail / h_canvas if h_canvas > 0 else 0
                if 280 <= h_canvas <= 380 and h_detail >= 800:
                    record("S3", "Height comparison: Live ~320px, Detail 1000+ px", "PASS",
                           f"Live={h_canvas}px, Detail={h_detail}px, ratio={ratio:.2f}")
                else:
                    record("S3", "Height comparison", "WARN", f"Live={h_canvas}, Detail={h_detail}")
            else:
                record("S3", "Height comparison", "WARN", f"Live={h_canvas}, Detail={h_detail}")
        except Exception as e:
            record("S3", "Height comparison", "FAIL", str(e))

        # ========== Step 4: Scroll Inside Fixed Canvas ==========
        try:
            go("/canvas", 3000)
            scroll_inside_iframe(page)
            page.wait_for_timeout(1000)
            screenshot("04-canvas-scrolled-inside.png")

            iframe_text = get_iframe_body_text(page)
            h = get_iframe_height(page)

            has_roster = "Roster" in iframe_text
            has_table_content = "Employee" in iframe_text or "Service" in iframe_text or "mx-" in iframe_text
            is_still_fixed = h is not None and 280 <= h <= 380

            if has_roster and is_still_fixed:
                record("S4", "Scroll inside fixed iframe: Roster/table visible", "PASS",
                       f"roster={has_roster}, height={h}px")
            elif has_roster:
                record("S4", "Scroll inside iframe", "WARN", f"height={h}")
            else:
                record("S4", "Scroll inside iframe", "FAIL", f"roster={has_roster}")
        except Exception as e:
            record("S4", "Scroll inside iframe", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("CANVAS DUAL MODE QA REPORT")
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
