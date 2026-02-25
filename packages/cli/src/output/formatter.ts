import Table from "cli-table3";
import chalk from "chalk";
import type { AgentTemplate, AgentInstanceMeta, SkillDefinition, PromptDefinition, McpServerDefinition, WorkflowDefinition, PluginDefinition } from "@actant/shared";

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
      t.provider?.type ?? chalk.dim("(default)"),
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
    `${chalk.bold("Provider:")} ${template.provider?.type ?? "(default)"}`,
  ];

  if (template.description) {
    lines.push(`${chalk.bold("Desc:")}     ${template.description}`);
  }

  lines.push("");
  lines.push(chalk.bold("Domain Context:"));
  lines.push(`  Skills:      ${ctx.skills?.length ?? 0} ref(s)   ${(ctx.skills ?? []).join(", ") || chalk.dim("none")}`);
  lines.push(`  Prompts:     ${ctx.prompts?.length ?? 0} ref(s)   ${(ctx.prompts ?? []).join(", ") || chalk.dim("none")}`);
  lines.push(`  MCP Servers: ${ctx.mcpServers?.length ?? 0} ref(s)   ${(ctx.mcpServers ?? []).map((s) => s.name).join(", ") || chalk.dim("none")}`);
  lines.push(`  Plugins:     ${ctx.plugins?.length ?? 0} ref(s)   ${(ctx.plugins ?? []).join(", ") || chalk.dim("none")}`);
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
      chalk.cyan("Archetype"),
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
      a.archetype ?? chalk.dim("tool"),
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
    `${chalk.bold("Archetype:")} ${agent.archetype ?? "tool"}`,
    `${chalk.bold("AutoStart:")} ${agent.autoStart ? chalk.green("yes") : chalk.dim("no")}`,
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

// ---------------------------------------------------------------------------
// Domain component formatters
// ---------------------------------------------------------------------------

export function formatSkillList(
  skills: SkillDefinition[],
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(skills, null, 2);
  if (format === "quiet") return skills.map((s) => s.name).join("\n");
  if (skills.length === 0) return chalk.dim("No skills loaded.");

  const table = new Table({
    head: [chalk.cyan("Name"), chalk.cyan("Tags"), chalk.cyan("Description")],
  });

  for (const s of skills) {
    table.push([
      s.name,
      s.tags?.join(", ") ?? chalk.dim("—"),
      s.description ?? chalk.dim("—"),
    ]);
  }

  return table.toString();
}

export function formatSkillDetail(
  skill: SkillDefinition,
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(skill, null, 2);
  if (format === "quiet") return skill.name;

  const lines = [
    `${chalk.bold("Skill:")}       ${skill.name}`,
    ...(skill.description ? [`${chalk.bold("Description:")} ${skill.description}`] : []),
    ...(skill.tags?.length ? [`${chalk.bold("Tags:")}        ${skill.tags.join(", ")}`] : []),
    "",
    chalk.bold("Content:"),
    skill.content,
  ];
  return lines.join("\n");
}

export function formatPromptList(
  prompts: PromptDefinition[],
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(prompts, null, 2);
  if (format === "quiet") return prompts.map((p) => p.name).join("\n");
  if (prompts.length === 0) return chalk.dim("No prompts loaded.");

  const table = new Table({
    head: [chalk.cyan("Name"), chalk.cyan("Variables"), chalk.cyan("Description")],
  });

  for (const p of prompts) {
    table.push([
      p.name,
      p.variables?.join(", ") ?? chalk.dim("—"),
      p.description ?? chalk.dim("—"),
    ]);
  }

  return table.toString();
}

export function formatPromptDetail(
  prompt: PromptDefinition,
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(prompt, null, 2);
  if (format === "quiet") return prompt.name;

  const lines = [
    `${chalk.bold("Prompt:")}      ${prompt.name}`,
    ...(prompt.description ? [`${chalk.bold("Description:")} ${prompt.description}`] : []),
    ...(prompt.variables?.length ? [`${chalk.bold("Variables:")}   ${prompt.variables.join(", ")}`] : []),
    "",
    chalk.bold("Content:"),
    prompt.content,
  ];
  return lines.join("\n");
}

export function formatMcpList(
  servers: McpServerDefinition[],
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(servers, null, 2);
  if (format === "quiet") return servers.map((s) => s.name).join("\n");
  if (servers.length === 0) return chalk.dim("No MCP servers loaded.");

  const table = new Table({
    head: [chalk.cyan("Name"), chalk.cyan("Command"), chalk.cyan("Description")],
  });

  for (const s of servers) {
    const cmd = [s.command, ...(s.args ?? [])].join(" ");
    table.push([
      s.name,
      cmd,
      s.description ?? chalk.dim("—"),
    ]);
  }

  return table.toString();
}

export function formatMcpDetail(
  server: McpServerDefinition,
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(server, null, 2);
  if (format === "quiet") return server.name;

  const lines = [
    `${chalk.bold("MCP Server:")}  ${server.name}`,
    ...(server.description ? [`${chalk.bold("Description:")} ${server.description}`] : []),
    `${chalk.bold("Command:")}     ${server.command}`,
    ...(server.args?.length ? [`${chalk.bold("Args:")}        ${server.args.join(" ")}`] : []),
  ];

  if (server.env && Object.keys(server.env).length > 0) {
    lines.push("");
    lines.push(chalk.bold("Environment:"));
    for (const [k, v] of Object.entries(server.env)) {
      lines.push(`  ${k}=${v}`);
    }
  }

  return lines.join("\n");
}

export function formatWorkflowList(
  workflows: WorkflowDefinition[],
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(workflows, null, 2);
  if (format === "quiet") return workflows.map((w) => w.name).join("\n");
  if (workflows.length === 0) return chalk.dim("No workflows loaded.");

  const table = new Table({
    head: [chalk.cyan("Name"), chalk.cyan("Description")],
  });

  for (const w of workflows) {
    table.push([w.name, w.description ?? chalk.dim("—")]);
  }

  return table.toString();
}

export function formatWorkflowDetail(
  workflow: WorkflowDefinition,
  format: OutputFormat,
): string {
  if (format === "json") return JSON.stringify(workflow, null, 2);
  if (format === "quiet") return workflow.name;

  const lines = [
    `${chalk.bold("Workflow:")}    ${workflow.name}`,
    ...(workflow.description ? [`${chalk.bold("Description:")} ${workflow.description}`] : []),
    "",
    chalk.bold("Content:"),
    workflow.content,
  ];
  return lines.join("\n");
}

export function formatPluginList(plugins: PluginDefinition[], format: OutputFormat): string {
  if (format === "json") return JSON.stringify(plugins, null, 2);
  if (format === "quiet") return plugins.map((p) => p.name).join("\n");
  if (plugins.length === 0) return chalk.dim("No plugins loaded.");

  const table = new Table({
    head: [chalk.cyan("Name"), chalk.cyan("Type"), chalk.cyan("Source"), chalk.cyan("Enabled"), chalk.cyan("Description")],
  });

  for (const p of plugins) {
    table.push([
      p.name,
      p.type,
      p.source ?? chalk.dim("—"),
      p.enabled !== false ? chalk.green("yes") : chalk.red("no"),
      p.description ?? chalk.dim("—"),
    ]);
  }

  return table.toString();
}

export function formatPluginDetail(plugin: PluginDefinition, format: OutputFormat): string {
  if (format === "json") return JSON.stringify(plugin, null, 2);
  if (format === "quiet") return plugin.name;

  const lines = [
    `${chalk.bold("Plugin:")}      ${plugin.name}`,
    ...(plugin.description ? [`${chalk.bold("Description:")} ${plugin.description}`] : []),
    `${chalk.bold("Type:")}        ${plugin.type}`,
    ...(plugin.source ? [`${chalk.bold("Source:")}      ${plugin.source}`] : []),
    `${chalk.bold("Enabled:")}     ${plugin.enabled !== false ? chalk.green("yes") : chalk.red("no")}`,
  ];

  if (plugin.config && Object.keys(plugin.config).length > 0) {
    lines.push("");
    lines.push(chalk.bold("Config:"));
    for (const [k, v] of Object.entries(plugin.config)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }
  }

  return lines.join("\n");
}
