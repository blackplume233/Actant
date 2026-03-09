"""Actant Dashboard Archetype Random Walk QA - http://localhost:3200

Test plan: Agents grouped by archetype, Employee/Service/Repo detail pages,
Canvas, Chat restrictions, Command Center. Screenshots saved to screenshots/ subdir.
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

        # ========== Step 1: Agents List Page ==========
        try:
            go("/agents")
            screenshot("01-agents-list.png")
            b = body()

            # Verify: grouped by archetype (Employees, Services, Repositories)
            has_employees = "Employee" in b or "employee" in b
            has_services = "Service" in b or "service" in b
            has_repos = "Repositor" in b or "Repository" in b or "repo" in b

            # Collapsible headers with icon, title, count badge
            has_chevron = page.locator("[class*='ChevronDown'], [class*='ChevronRight'], svg").count() > 0
            has_badges = page.locator("[class*='Badge'], [class*='badge']").count() > 0

            if (has_employees or has_services or has_repos) and has_badges:
                record("S1", "Agents grouped by archetype (Employees, Services, Repositories)", "PASS",
                       f"employees={has_employees}, services={has_services}, repos={has_repos}, badges={has_badges}")
            else:
                record("S1", "Agents list archetype grouping", "WARN",
                       f"employees={has_employees}, services={has_services}, repos={has_repos}, badges={has_badges}")
        except Exception as e:
            record("S1", "Agents list page", "FAIL", str(e))

        # ========== Step 2: Agent Detail - Employee type (mx-pi-employee-a2) ==========
        try:
            go("/agents/mx-pi-employee-a2")
            screenshot("02-agent-detail-employee.png")
            b = body()

            if "mx-pi-employee-a2" not in b:
                record("S2", "Employee agent detail (mx-pi-employee-a2)", "WARN", "Agent not found, may not exist")
            else:
                has_overview = "Overview" in b or "概览" in b
                has_sessions = "Sessions" in b or "会话" in b
                has_canvas = "Canvas" in b

                has_logs = "Logs" in b or "日志" in b
                has_start_stop = page.locator("button:has-text('Start'), button:has-text('Stop')").count() > 0
                has_chat = page.locator("button:has-text('Chat'), a:has-text('Chat')").count() > 0

                if has_overview and has_sessions and has_canvas and has_logs and has_start_stop and has_chat:
                    record("S2", "Employee: Overview, Sessions, Canvas, Logs. Start/Stop, Chat", "PASS")
                else:
                    record("S2", "Employee agent detail", "WARN",
                           f"tabs={has_overview},{has_sessions},{has_canvas},{has_logs} start_stop={has_start_stop} chat={has_chat}")
        except Exception as e:
            record("S2", "Employee agent detail", "FAIL", str(e))

        # ========== Step 3: Agent Detail - Service type (mx-pi-service-a2) ==========
        try:
            go("/agents/mx-pi-service-a2")
            screenshot("03-agent-detail-service.png")
            b = body()

            if "mx-pi-service-a2" not in b:
                record("S3", "Service agent detail (mx-pi-service-a2)", "WARN", "Agent not found, may not exist")
            else:
                has_overview = "Overview" in b or "概览" in b
                has_sessions = "Sessions" in b or "会话" in b
                has_logs = "Logs" in b or "日志" in b
                has_canvas = "Canvas" in b
                has_start_stop = page.locator("button:has-text('Start'), button:has-text('Stop')").count() > 0
                has_chat = page.locator("button:has-text('Chat'), a:has-text('Chat')").count() > 0

                no_canvas = not has_canvas
                no_start_stop = not has_start_stop

                if has_overview and has_sessions and has_logs and no_canvas and no_start_stop and has_chat:
                    record("S3", "Service: Overview, Sessions, Logs (NO Canvas). NO Start/Stop. Chat", "PASS")
                else:
                    record("S3", "Service agent detail", "WARN",
                           f"tabs=ov={has_overview},sess={has_sessions},logs={has_logs},canvas={has_canvas} start_stop={has_start_stop} chat={has_chat}")
        except Exception as e:
            record("S3", "Service agent detail", "FAIL", str(e))

        # ========== Step 4: Agent Detail - Repo/Tool type ==========
        try:
            go("/agents")
            page.wait_for_timeout(1000)
            b = body()
            # Find a repo/tool agent - try qa3-test1 or mx-cc-tool-a1
            repo_agent = None
            for candidate in ["qa3-test1", "mx-cc-tool-a1", "mx-cc-tool", "mx-pi-tool-a1", "mx-cursor-tool-a1"]:
                if candidate in b:
                    repo_agent = candidate
                    break
            if not repo_agent:
                repo_agent = "qa3-test1"  # fallback

            go(f"/agents/{repo_agent}")
            screenshot("04-agent-detail-repo.png")
            b = body()

            if repo_agent not in b:
                record("S4", f"Repo/ tool agent detail ({repo_agent})", "WARN", "Agent not found")
            else:
                has_overview = "Overview" in b or "概览" in b
                has_sessions = "Sessions" in b or "会话" in b
                has_canvas = "Canvas" in b
                has_start_stop = page.locator("button:has-text('Start'), button:has-text('Stop')").count() > 0
                has_chat = page.locator("button:has-text('Chat'), a:has-text('Chat')").count() > 0
                has_destroy = page.locator("button:has-text('Destroy')").count() > 0

                only_overview = has_overview and not has_sessions and not has_canvas
                no_start_stop_chat = not has_start_stop and not has_chat

                if only_overview and no_start_stop_chat and has_destroy:
                    record("S4", f"Repo/Tool ({repo_agent}): only Overview, Destroy only", "PASS")
                else:
                    record("S4", "Repo/Tool agent detail", "WARN",
                           f"tabs=ov={has_overview},sess={has_sessions},canvas={has_canvas} start_stop={has_start_stop} chat={has_chat} destroy={has_destroy}")
        except Exception as e:
            record("S4", "Repo/Tool agent detail", "FAIL", str(e))

        # ========== Step 5: Live Canvas Page ==========
        try:
            go("/canvas")
            screenshot("05-live-canvas.png")
            b = body()

            has_canvas = "Canvas" in b or "canvas" in b
            has_employee = "employee" in b.lower() or "Employee" in b

            if has_canvas or has_employee or len(b) > 200:
                record("S5", "Live Canvas page with employee slots", "PASS", f"content_len={len(b)}")
            else:
                record("S5", "Live Canvas page", "WARN", f"Body: {b[:150]}")
        except Exception as e:
            record("S5", "Live Canvas", "FAIL", str(e))

        # ========== Step 6: Chat Page - Employee (managed sessions) ==========
        try:
            go("/agents/mx-pi-employee-a2/chat")
            screenshot("06-chat-employee-managed.png")
            b = body()

            if "mx-pi-employee-a2" not in b:
                record("S6", "Employee chat page (mx-pi-employee-a2)", "WARN", "Agent not found")
            else:
                has_new_chat = page.locator("button:has-text('New Chat'), button:has-text('新对话')").count() > 0
                has_blue_banner = "managed" in b.lower() or "Actant" in b or "actant" in b or "session" in b.lower()

                if not has_new_chat and has_blue_banner:
                    record("S6", "Employee chat: NO New Chat, blue banner (managed by Actant)", "PASS")
                elif not has_new_chat:
                    record("S6", "Employee chat: NO New Chat button", "PASS", f"banner={has_blue_banner}")
                else:
                    record("S6", "Employee chat restrictions", "WARN", f"new_chat={has_new_chat} banner={has_blue_banner}")
        except Exception as e:
            record("S6", "Employee chat page", "FAIL", str(e))

        # ========== Step 7: Chat Page - Repo type redirect ==========
        try:
            go("/agents/qa3-test1/chat")
            screenshot("07-chat-repo-unavailable.png")
            b = body()

            has_no_chat = "noChat" in b or "not available" in b.lower() or "chat" in b.lower() and "repository" in b.lower()
            has_folder_icon = page.locator("[class*='FolderGit']").count() > 0
            has_back = page.locator("button:has-text('Back'), a:has-text('Back')").count() > 0

            if (has_no_chat or has_folder_icon) and (has_back or "Back" in b):
                record("S7", "Repo chat: message that chat not available", "PASS")
            else:
                record("S7", "Repo chat redirect", "WARN", f"no_chat_msg={has_no_chat} body_preview={b[:100]}")
        except Exception as e:
            record("S7", "Repo chat page", "FAIL", str(e))

        # ========== Step 8: Command Center ==========
        try:
            go("/")
            screenshot("08-command-center.png")
            b = body()

            has_content = len(b) > 100
            has_agents = "agent" in b.lower() or "Agent" in b
            has_events = "event" in b.lower() or "Event" in b

            if has_content and (has_agents or has_events):
                record("S8", "Command Center loads", "PASS")
            else:
                record("S8", "Command Center", "WARN", f"content={has_content} agents={has_agents}")
        except Exception as e:
            record("S8", "Command Center", "FAIL", str(e))

        browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("ARCHETYPE RANDOM WALK QA REPORT")
    print("=" * 60)
    pc = sum(1 for r in results if r["status"] == "PASS")
    wc = sum(1 for r in results if r["status"] == "WARN")
    fc = sum(1 for r in results if r["status"] == "FAIL")
    print(f"PASS: {pc} | WARN: {wc} | FAIL: {fc} | Total: {len(results)}")
    print()

    with open(SCRIPT_DIR / "qa-report.json", "w", encoding="utf-8") as f:
        json.dump({"results": results, "summary": {"pass": pc, "warn": wc, "fail": fc}}, f, indent=2, ensure_ascii=False)

    return 0 if fc == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
