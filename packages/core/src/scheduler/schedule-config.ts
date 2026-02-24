import { z } from "zod/v4";

export const HeartbeatConfigSchema = z.object({
  intervalMs: z.number().min(1000),
  prompt: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
});

export const CronConfigSchema = z.object({
  pattern: z.string().min(1),
  prompt: z.string().min(1),
  timezone: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
});

export const HookConfigSchema = z.object({
  eventName: z.string().min(1),
  prompt: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
});

export const ScheduleConfigSchema = z.object({
  heartbeat: HeartbeatConfigSchema.optional(),
  cron: z.array(CronConfigSchema).optional().default([]),
  hooks: z.array(HookConfigSchema).optional().default([]),
});

export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type ScheduleConfigInput = z.input<typeof ScheduleConfigSchema>;
