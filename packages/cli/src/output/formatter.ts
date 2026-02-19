import Table from "cli-table3";
import chalk from "chalk";
import type { AgentTemplate, AgentInstanceMeta } from "@agentcraft/shared";

export type OutputFormat = "table" | "json" | "quiet";

export function formatTemplateList(
  templates: AgentTemplate[],
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(templates, null, 2);
  }

  if (format === "quiet") {
    return templates.map((t) => t.name).join("\n");
  }

  if (templates.length === 0) {
    return chalk.dim("No templates registered.");
  }

  const table = new Table({
    head: [
      chalk.cyan("Name"),
      chalk.cyan("Version"),
      chalk.cyan("Backend"),
      chalk.cyan("Provider"),
      chalk.cyan("Description"),
    ],
  });

  for (const t of templates) {
    table.push([
      t.name,
      t.version,
      t.backend.type,
      t.provider.type,
      t.description ?? chalk.dim("—"),
    ]);
  }

  return table.toString();
}

export function formatTemplateDetail(
  template: AgentTemplate,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(template, null, 2);
  }

  if (format === "quiet") {
    return template.name;
  }

  const ctx = template.domainContext;
  const lines = [
    `${chalk.bold("Template:")} ${template.name}`,
    `${chalk.bold("Version:")}  ${template.version}`,
    `${chalk.bold("Backend:")}  ${template.backend.type}`,
    `${chalk.bold("Provider:")} ${template.provider.type}`,
  ];

  if (template.description) {
    lines.push(`${chalk.bold("Desc:")}     ${template.description}`);
  }

  lines.push("");
  lines.push(chalk.bold("Domain Context:"));
  lines.push(`  Skills:      ${ctx.skills?.length ?? 0} ref(s)   ${(ctx.skills ?? []).join(", ") || chalk.dim("none")}`);
  lines.push(`  Prompts:     ${ctx.prompts?.length ?? 0} ref(s)   ${(ctx.prompts ?? []).join(", ") || chalk.dim("none")}`);
  lines.push(`  MCP Servers: ${ctx.mcpServers?.length ?? 0} ref(s)   ${(ctx.mcpServers ?? []).map((s) => s.name).join(", ") || chalk.dim("none")}`);
  lines.push(`  Workflow:    ${ctx.workflow ?? chalk.dim("none")}`);
  lines.push(`  SubAgents:   ${(ctx.subAgents ?? []).join(", ") || chalk.dim("none")}`);

  if (template.metadata && Object.keys(template.metadata).length > 0) {
    lines.push("");
    lines.push(chalk.bold("Metadata:"));
    for (const [k, v] of Object.entries(template.metadata)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  return lines.join("\n");
}

const STATUS_COLORS: Record<string, (text: string) => string> = {
  created: chalk.blue,
  starting: chalk.yellow,
  running: chalk.green,
  stopping: chalk.yellow,
  stopped: chalk.gray,
  error: chalk.red,
};

function colorStatus(status: string): string {
  const fn = STATUS_COLORS[status] ?? chalk.white;
  return fn(status);
}

export function formatAgentList(
  agents: AgentInstanceMeta[],
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(agents, null, 2);
  }

  if (format === "quiet") {
    return agents.map((a) => a.name).join("\n");
  }

  if (agents.length === 0) {
    return chalk.dim("No agents found.");
  }

  const table = new Table({
    head: [
      chalk.cyan("Name"),
      chalk.cyan("Template"),
      chalk.cyan("Status"),
      chalk.cyan("Launch Mode"),
      chalk.cyan("PID"),
      chalk.cyan("Created"),
    ],
  });

  for (const a of agents) {
    table.push([
      a.name,
      `${a.templateName}@${a.templateVersion}`,
      colorStatus(a.status),
      a.launchMode,
      a.pid?.toString() ?? chalk.dim("—"),
      a.createdAt.slice(0, 19).replace("T", " "),
    ]);
  }

  return table.toString();
}

export function formatAgentDetail(
  agent: AgentInstanceMeta,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify(agent, null, 2);
  }

  if (format === "quiet") {
    return agent.name;
  }

  const lines = [
    `${chalk.bold("Agent:")}     ${agent.name}`,
    `${chalk.bold("ID:")}        ${agent.id}`,
    `${chalk.bold("Template:")}  ${agent.templateName}@${agent.templateVersion}`,
    `${chalk.bold("Status:")}    ${colorStatus(agent.status)}`,
    `${chalk.bold("Launch:")}    ${agent.launchMode}`,
    `${chalk.bold("PID:")}       ${agent.pid ?? chalk.dim("—")}`,
    `${chalk.bold("Created:")}   ${agent.createdAt}`,
    `${chalk.bold("Updated:")}   ${agent.updatedAt}`,
  ];

  if (agent.metadata && Object.keys(agent.metadata).length > 0) {
    lines.push("");
    lines.push(chalk.bold("Metadata:"));
    for (const [k, v] of Object.entries(agent.metadata)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  return lines.join("\n");
}
