import json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3212"
TASK_DIR = Path(__file__).resolve().parent
SHOT = TASK_DIR / "screenshots" / "d4b-chat-service-submit.png"


def main():
    probe = "qa-service-chat-probe-20260301"
    result = {"status": "FAIL", "detail": ""}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(
            f"{BASE}/agents/qa-svc-chat/chat",
            wait_until="domcontentloaded",
            timeout=15000,
        )
        page.wait_for_timeout(1500)

        box = page.locator("textarea").first
        if box.count() == 0:
            result["detail"] = "textarea not found"
        else:
            disabled = box.get_attribute("disabled") is not None
            if disabled:
                result["status"] = "WARN"
                result["detail"] = "textarea disabled for service chat"
            else:
                box.fill(probe)
                page.keyboard.press("Enter")
                page.wait_for_timeout(2000)
                body = page.inner_text("body")
                echoed = probe in body
                has_feedback = any(
                    x in body
                    for x in [
                        "Auto-start failed",
                        "自动启动失败",
                        "Thinking",
                        "思考中",
                        "not found",
                        "not running",
                    ]
                )
                result["status"] = "PASS" if echoed else "FAIL"
                result["detail"] = f"echoed={echoed} feedback={has_feedback}"

        page.screenshot(path=str(SHOT))
        browser.close()

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
