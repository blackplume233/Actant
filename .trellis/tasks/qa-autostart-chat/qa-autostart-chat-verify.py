"""Verify auto-start on chat feature for service agents - http://localhost:3200

Test: Service chat (created, running, error), Employee chat (created),
orange banner, input enabled/disabled.
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

        # ========== Step 1: Service Chat - Not Running (steward-a1) ==========
        try:
            go("/agents/steward-a1/chat", 5000)
            screenshot("01-service-chat-not-running.png")
            b = body()

            has_orange_banner = "自动启动" in b or "auto-start" in b.lower() or "服务当前未运行" in b
            has_old_hint = "请从详情页启动" in b
            has_new_hint = "发送消息即可开始" in b or "按需自动启动" in b

            textarea = page.locator("textarea").first
            input_disabled = textarea.get_attribute("disabled") is not None if textarea.count() > 0 else True

            if has_orange_banner and not input_disabled and (has_new_hint or not has_old_hint):
                record("S1", "Service chat (created): orange banner, input enabled, new hint", "PASS",
                       f"orange={has_orange_banner}, disabled={input_disabled}")
            elif has_orange_banner and not input_disabled:
                record("S1", "Service chat (created)", "WARN", f"hint_old={has_old_hint}, new={has_new_hint}")
            else:
                record("S1", "Service chat (created)", "FAIL", f"orange={has_orange_banner}, disabled={input_disabled}")
        except Exception as e:
            record("S1", "Service chat steward-a1", "FAIL", str(e))

        # ========== Step 2: Service Chat - Type a Message ==========
        try:
            textarea = page.locator("textarea").first
            if textarea.count() > 0:
                textarea.fill("你好")
                page.wait_for_timeout(500)
                screenshot("02-service-chat-typed.png")

                send_btn = page.locator("button").filter(has=page.locator("svg")).last
                send_disabled = send_btn.is_disabled() if send_btn.count() > 0 else True
                input_val = textarea.input_value()

                if input_val == "你好" and not send_disabled:
                    record("S2", "Service chat: input accepts text, send enabled", "PASS")
                elif input_val == "你好":
                    record("S2", "Service chat type", "WARN", f"send_disabled={send_disabled}")
                else:
                    record("S2", "Service chat type", "FAIL", f"input={input_val}")
            else:
                record("S2", "Service chat type", "FAIL", "No textarea")
        except Exception as e:
            record("S2", "Service chat type", "FAIL", str(e))

        # ========== Step 3: Service Chat - Running (mx-pi-service-a2) ==========
        try:
            go("/agents/mx-pi-service-a2/chat", 3000)
            screenshot("03-service-chat-running.png")
            b = body()

            has_orange_banner = "自动启动" in b or "服务当前未运行" in b
            has_new_chat = page.locator("button:has-text('New Chat'), button:has-text('新对话')").count() > 0
            has_running_hint = "正在运行" in b or "可以开始对话" in b
            has_managed_banner = "托管" in b and "Actant" in b

            textarea = page.locator("textarea").first
            input_disabled = textarea.get_attribute("disabled") is not None if textarea.count() > 0 else True

            if not has_orange_banner and not input_disabled and has_new_chat and has_running_hint:
                record("S3", "Service chat (running): no orange banner, input enabled, New Chat", "PASS")
            elif not has_orange_banner and not input_disabled:
                record("S3", "Service chat (running)", "WARN", f"new_chat={has_new_chat}, hint={has_running_hint}")
            else:
                record("S3", "Service chat (running)", "FAIL", f"orange={has_orange_banner}, disabled={input_disabled}")
        except Exception as e:
            record("S3", "Service chat running", "FAIL", str(e))

        # ========== Step 4: Employee Chat - Not Running (maintainer-a1) ==========
        try:
            go("/agents/maintainer-a1/chat", 3000)
            screenshot("04-employee-chat-not-running.png")
            b = body()

            has_blue_banner = "托管" in b or "managed" in b.lower()
            has_orange_banner = "自动启动" in b or "服务当前未运行" in b
            has_stopped_hint = "请从详情页启动" in b or "已停止" in b

            textarea = page.locator("textarea").first
            input_disabled = textarea.get_attribute("disabled") is not None if textarea.count() > 0 else False

            if has_blue_banner and not has_orange_banner and input_disabled and has_stopped_hint:
                record("S4", "Employee chat (created): blue banner, no orange, input disabled", "PASS")
            elif has_blue_banner and input_disabled:
                record("S4", "Employee chat (created)", "WARN", f"orange={has_orange_banner}")
            else:
                record("S4", "Employee chat (created)", "FAIL", f"blue={has_blue_banner}, disabled={input_disabled}")
        except Exception as e:
            record("S4", "Employee chat", "FAIL", str(e))

        # ========== Step 5: Service Chat - Error State (mx-cc-service-a1) ==========
        try:
            go("/agents/mx-cc-service-a1/chat", 3000)
            screenshot("05-service-chat-error.png")
            b = body()

            has_orange_banner = "自动启动" in b or "服务当前未运行" in b
            textarea = page.locator("textarea").first
            input_disabled = textarea.get_attribute("disabled") is not None if textarea.count() > 0 else True

            if has_orange_banner and not input_disabled:
                record("S5", "Service chat (error): orange banner, input enabled", "PASS")
            elif has_orange_banner:
                record("S5", "Service chat (error)", "WARN", f"input_disabled={input_disabled}")
            else:
                record("S5", "Service chat (error)", "FAIL", f"orange={has_orange_banner}, disabled={input_disabled}")
        except Exception as e:
            record("S5", "Service chat error", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("AUTO-START ON CHAT QA REPORT")
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
