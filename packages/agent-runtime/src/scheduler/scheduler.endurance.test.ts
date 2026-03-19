/**
 * Endurance coverage: Phase 4 (scheduler dynamic sources)
 * Verifies E-SCHED baseline for DelayInput + CronInput + dynamic source registration.
 *
 * Run via:
 *   pnpm test:endurance
 *   ENDURANCE_DURATION_MS=5000 pnpm test:endurance
 */
import { describe, it, expect } from "vitest";
import { EmployeeScheduler } from "./employee-scheduler";
import type { PromptAgentFn } from "./task-dispatcher";
import type { InputSource } from "./inputs/input-source";

const DURATION_MS = parseInt(process.env.ENDURANCE_DURATION_MS ?? "30000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Endurance tests — Scheduler", () => {
  it(`E-SCHED: multi-source scheduler pressure — ${DURATION_MS}ms`, async () => {
    const promptAgent: PromptAgentFn = async () => "ok";
    const scheduler = new EmployeeScheduler("sched-endurance", promptAgent);

    scheduler.configure({
      heartbeat: { intervalMs: 1000, prompt: "heartbeat" },
      cron: [{ pattern: "*/1 * * * * *", prompt: "cron" }],
    });
    scheduler.start();

    scheduler.registerInputType("custom-pulse", (config: { id: string; prompt: string; intervalMs: number }) => {
      let timer: ReturnType<typeof setInterval> | undefined;
      let active = false;
      const source: InputSource = {
        id: config.id,
        type: "custom-pulse",
        start(agentName, onTask) {
          if (active) return;
          active = true;
          timer = setInterval(() => {
            onTask({
              id: `${config.id}-${Date.now()}`,
              agentName,
              prompt: config.prompt,
              priority: "normal",
              source: "custom-pulse",
              createdAt: new Date().toISOString(),
            });
          }, config.intervalMs);
        },
        stop() {
          if (timer) clearInterval(timer);
          timer = undefined;
          active = false;
        },
        get active() {
          return active;
        },
      };
      return source;
    });

    const customId = scheduler.createInput("custom-pulse", {
      id: "custom:pulse",
      prompt: "custom",
      intervalMs: 1000,
    });

    let delayCount = 0;
    let cancelSuccesses = 0;
    let loopCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < DURATION_MS) {
      const delayId = scheduler.scheduleDelay({
        delayMs: 1000,
        prompt: `delay-${loopCount}`,
        id: `delay:${loopCount}`,
      });
      delayCount++;

      if (loopCount % 2 === 1) {
        if (scheduler.unregisterInput(delayId)) {
          cancelSuccesses++;
        }
      }

      await sleep(1000);
      loopCount++;
    }

    await sleep(1200);

    const { queued, tasks } = scheduler.getTasks();
    const sources = scheduler.getSources();

    expect(sources.some((s) => s.id === customId && s.type === "custom-pulse")).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    expect(queued).toBeGreaterThan(0);
    expect(cancelSuccesses).toBeGreaterThan(0);
    expect(tasks.every((task) => {
      const t = task as { source: string };
      return ["heartbeat", "custom-pulse"].some((prefix) => t.source.startsWith(prefix))
        || t.source.startsWith("cron:")
        || t.source === "delay";
    })).toBe(true);

    scheduler.stop();

    console.log(
      `[endurance] E-SCHED: ${loopCount} loops, ${delayCount} delays, ${cancelSuccesses} cancels, ${tasks.length} queued in ${Date.now() - startTime}ms`,
    );
  });
});
