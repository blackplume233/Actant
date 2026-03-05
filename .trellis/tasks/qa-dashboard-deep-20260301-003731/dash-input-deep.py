import json
from pathlib import Path
from playwright.sync_api import sync_playwright


BASE = "http://localhost:3212"
TASK_DIR = Path(__file__).resolve().parent
SHOT_DIR = TASK_DIR / "screenshots"
SHOT_DIR.mkdir(exist_ok=True)


def run():
    results = []
    console_errors = []

    def rec(case_id: str, desc: str, status: str, detail: str = ""):
        results.append(
            {"id": case_id, "desc": desc, "status": status, "detail": detail}
        )
        print(f"[{status}] {case_id}: {desc} {detail}".strip())

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error"
            else None,
        )

        # D1: Command Center loads
        try:
            page.goto(f"{BASE}/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1500)
            page.screenshot(path=str(SHOT_DIR / "d1-command-center.png"))
            body = page.inner_text("body")
            has_title = any(x in body for x in ["Command Center", "控制中心", "控制台"])
            has_agents_block = any(x in body for x in ["Agents", "智能体"])
            rec(
                "D1",
                "Command Center render",
                "PASS" if (has_title and has_agents_block) else "WARN",
                f"title={has_title} agents={has_agents_block}",
            )
        except Exception as err:
            rec("D1", "Command Center render", "FAIL", str(err))

        # D2: Agents page search input simulation
        try:
            page.goto(f"{BASE}/agents", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1200)
            search = page.locator(
                "input[placeholder*='Search'], input[placeholder*='搜索']"
            ).first
            if search.count() == 0:
                rec("D2", "Agents search input", "FAIL", "search input not found")
            else:
                search.fill("qa-dash")
                page.wait_for_timeout(1000)
                page.screenshot(path=str(SHOT_DIR / "d2-agents-search.png"))
                body = page.inner_text("body")
                matched = all(
                    x in body for x in ["qa-dash-a", "qa-dash-b", "qa-dash-c"]
                )
                rec(
                    "D2",
                    "Agents search input",
                    "PASS" if matched else "WARN",
                    f"all_three_visible={matched}",
                )
                search.fill("")
        except Exception as err:
            rec("D2", "Agents search input", "FAIL", str(err))

        # D3: Agents status filter interactions
        try:
            # one agent should be in error due failed start
            error_badge = page.locator("text=Error, text=异常").first
            all_badge = page.locator("text=All, text=全部").first
            interacted = False
            if error_badge.count() > 0:
                error_badge.click()
                page.wait_for_timeout(800)
                interacted = True
            if all_badge.count() > 0:
                all_badge.click()
                page.wait_for_timeout(800)
                interacted = True
            page.screenshot(path=str(SHOT_DIR / "d3-agents-filters.png"))
            rec(
                "D3",
                "Agents filter badges",
                "PASS" if interacted else "WARN",
                f"interacted={interacted}",
            )
        except Exception as err:
            rec("D3", "Agents filter badges", "FAIL", str(err))

        # D4: Agent detail + chat input submit simulation
        probe = "qa-deep-input-probe-20260301"
        try:
            page.goto(
                f"{BASE}/agents/qa-dash-a/chat",
                wait_until="domcontentloaded",
                timeout=15000,
            )
            page.wait_for_timeout(1200)
            box = page.locator("textarea").first
            if box.count() == 0:
                rec("D4", "Chat input submit", "FAIL", "textarea not found")
            else:
                box.fill(probe)
                page.keyboard.press("Enter")
                page.wait_for_timeout(1800)
                page.screenshot(path=str(SHOT_DIR / "d4-chat-input-submit.png"))
                body = page.inner_text("body")
                user_echo = probe in body
                has_feedback = any(
                    x in body
                    for x in [
                        "Auto-start failed",
                        "自动启动失败",
                        "Thinking",
                        "思考中",
                        "not running",
                        "未运行",
                    ]
                )
                status = "PASS" if user_echo else "FAIL"
                detail = f"user_echo={user_echo} feedback={has_feedback}"
                if status == "PASS" and not has_feedback:
                    status = "WARN"
                rec("D4", "Chat input submit", status, detail)
        except Exception as err:
            rec("D4", "Chat input submit", "FAIL", str(err))

        # D5: Events search input simulation
        try:
            page.goto(f"{BASE}/events", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1200)
            search = page.locator(
                "input[placeholder*='Search'], input[placeholder*='搜索']"
            ).first
            if search.count() == 0:
                rec("D5", "Events search input", "FAIL", "search input not found")
            else:
                search.fill("agent:")
                page.wait_for_timeout(1200)
                page.screenshot(path=str(SHOT_DIR / "d5-events-search.png"))
                body = page.inner_text("body")
                filtered = ("agent:" in body) or ("事件" in body) or ("Event" in body)
                rec(
                    "D5",
                    "Events search input",
                    "PASS" if filtered else "WARN",
                    f"filtered={filtered}",
                )
        except Exception as err:
            rec("D5", "Events search input", "FAIL", str(err))

        # D6: Settings connection snapshot
        try:
            page.goto(f"{BASE}/settings", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1200)
            page.screenshot(path=str(SHOT_DIR / "d6-settings.png"))
            body = page.inner_text("body")
            ok = any(x in body for x in ["Connected", "已连接", "Version", "版本"])
            rec(
                "D6",
                "Settings health view",
                "PASS" if ok else "WARN",
                f"connected_markers={ok}",
            )
        except Exception as err:
            rec("D6", "Settings health view", "FAIL", str(err))

        critical = [
            e
            for e in console_errors
            if any(k in e for k in ["TypeError", "ReferenceError", "SyntaxError"])
        ]
        rec(
            "D7",
            "Browser console critical errors",
            "PASS" if len(critical) == 0 else "FAIL",
            f"critical_count={len(critical)}",
        )

        browser.close()

    summary = {
        "pass": sum(1 for r in results if r["status"] == "PASS"),
        "warn": sum(1 for r in results if r["status"] == "WARN"),
        "fail": sum(1 for r in results if r["status"] == "FAIL"),
        "total": len(results),
    }
    payload = {"results": results, "summary": summary}
    (TASK_DIR / "dash-input-results.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run()
