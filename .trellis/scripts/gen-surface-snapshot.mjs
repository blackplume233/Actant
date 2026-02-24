#!/usr/bin/env node
/**
 * Generate API Surface & Config Schema snapshot for a staged version.
 *
 * Extracts from source:
 *   1. RPC methods (from RpcMethodMap in rpc.types.ts)
 *   2. RPC param/result type shapes (from rpc.types.ts)
 *   3. CLI commands & subcommands (from packages/cli/src/commands/)
 *   4. Config schemas (Zod schemas from core)
 *   5. Type interfaces (from shared/types/)
 *
 * Outputs:
 *   - api-surface.md   (human-readable)
 *   - api-surface.json  (machine-readable, for diff)
 *   - config-schemas.md  (human-readable)
 *   - config-schemas.json (machine-readable, for diff)
 *
 * Usage: node gen-surface-snapshot.mjs <output-dir>
 */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const outputDir = process.argv[2] || join(ROOT, "docs", "stage", "v0.1.0");

// =============================================================================
// Source file paths
// =============================================================================

const PATHS = {
  rpcTypes: join(ROOT, "packages/shared/src/types/rpc.types.ts"),
  agentTypes: join(ROOT, "packages/shared/src/types/agent.types.ts"),
  templateTypes: join(ROOT, "packages/shared/src/types/template.types.ts"),
  domainContextTypes: join(ROOT, "packages/shared/src/types/domain-context.types.ts"),
  domainComponentTypes: join(ROOT, "packages/shared/src/types/domain-component.types.ts"),
  sourceTypes: join(ROOT, "packages/shared/src/types/source.types.ts"),
  templateSchema: join(ROOT, "packages/core/src/template/schema/template-schema.ts"),
  instanceMetaSchema: join(ROOT, "packages/core/src/state/instance-meta-schema.ts"),
  scheduleConfigSchema: join(ROOT, "packages/core/src/scheduler/schedule-config.ts"),
  cliCommands: join(ROOT, "packages/cli/src/commands"),
  program: join(ROOT, "packages/cli/src/program.ts"),
};

// =============================================================================
// Parsers
// =============================================================================

function extractRpcMethods(source) {
  const methods = [];
  const mapRegex = /["']([a-z]+\.[a-z]+)["']\s*:\s*\{\s*params:\s*(\w+)\s*;\s*result:\s*(\w+)\s*\}/g;
  let match;
  while ((match = mapRegex.exec(source))) {
    methods.push({ method: match[1], paramsType: match[2], resultType: match[3] });
  }
  return methods;
}

function extractInterfaces(source) {
  const interfaces = [];
  const ifaceRegex = /export\s+(?:interface|type)\s+(\w+)\s*(?:=\s*([^;{]+);|\{([^}]*)\}|=\s*\{([^}]*)\})/gs;
  let match;
  while ((match = ifaceRegex.exec(source))) {
    const name = match[1];
    const body = match[3] || match[4] || match[2] || "";
    const fields = [];

    if (body.includes(":")) {
      const fieldRegex = /(\w+)(\??)\s*:\s*([^;]+)/g;
      let fm;
      while ((fm = fieldRegex.exec(body))) {
        fields.push({
          name: fm[1],
          optional: fm[2] === "?",
          type: fm[3].trim().replace(/\s+/g, " "),
        });
      }
    }

    interfaces.push({ name, fields, raw: body.trim() });
  }
  return interfaces;
}

function extractEnums(source) {
  const enums = [];
  const enumRegex = /export\s+(?:type|const)\s+(\w+)\s*=\s*(?:z\.enum\(\[([^\]]+)\]\)|([^;]+))/g;
  let match;
  while ((match = enumRegex.exec(source))) {
    const name = match[1];
    const values = (match[2] || match[3] || "")
      .replace(/["']/g, "")
      .split(/[|,]/)
      .map(v => v.trim())
      .filter(Boolean);
    if (values.length > 0 && values[0] !== "Record" && !values[0].includes("{")) {
      enums.push({ name, values });
    }
  }
  return enums;
}

function extractZodFieldValue(source, startIdx) {
  let depth = 0;
  let i = startIdx;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) break;
      depth--;
    } else if ((ch === "," || ch === "\n") && depth === 0) break;
    i++;
  }
  return source.slice(startIdx, i).trim().replace(/\s+/g, " ");
}

function extractZodSchemas(source) {
  const schemas = [];
  const schemaRegex = /export\s+const\s+(\w+Schema)\s*=\s*z\.(object|enum|array)\(/g;
  let match;
  while ((match = schemaRegex.exec(source))) {
    const name = match[1];
    const kind = match[2];
    const bodyStart = match.index + match[0].length;

    let depth = 1;
    let bodyEnd = bodyStart;
    while (bodyEnd < source.length && depth > 0) {
      if (source[bodyEnd] === "(") depth++;
      else if (source[bodyEnd] === ")") depth--;
      bodyEnd++;
    }
    const body = source.slice(bodyStart, bodyEnd - 1);
    const fields = [];

    if (kind === "object") {
      const objBody = body.replace(/^\{/, "").replace(/\}$/, "");
      const fieldNameRegex = /(\w+)\s*:\s*(\w)/g;
      let fm;
      while ((fm = fieldNameRegex.exec(objBody))) {
        const fieldName = fm[1];
        if (["const", "export", "import", "function", "return", "let", "var", "type"].includes(fieldName)) continue;
        const valueStart = fm.index + fm[0].length - 1;
        const zodType = extractZodFieldValue(objBody, valueStart);
        if (zodType && !zodType.startsWith("//")) {
          fields.push({ name: fieldName, zodType });
        }
      }
    } else if (kind === "enum") {
      const valuesMatch = body.match(/\[([^\]]+)\]/);
      if (valuesMatch) {
        const vals = valuesMatch[1].replace(/["'\s]/g, "");
        fields.push({ name: "_values", zodType: vals });
      }
    }

    schemas.push({ name, kind, fields });
  }
  return schemas;
}

async function extractCliCommands(commandsDir) {
  const groups = [];
  const entries = await readdir(commandsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "__tests__" || entry.name === "index.ts") continue;

    if (entry.isDirectory()) {
      const indexFile = join(commandsDir, entry.name, "index.ts");
      let source;
      try { source = await readFile(indexFile, "utf8"); } catch { continue; }

      const group = { name: entry.name, alias: null, subcommands: [] };

      // Match both new Command("x").alias("y") and .alias("y")
      const cmdMatch = source.match(/new\s+Command\(["'](\w[\w-]*)["']\)/);
      if (cmdMatch) group.name = cmdMatch[1];
      const aliasMatch = source.match(/\.alias\(["']([\w-]+)["']\)/);
      if (aliasMatch) group.alias = aliasMatch[1];

      const subFiles = await readdir(join(commandsDir, entry.name));
      for (const sf of subFiles) {
        if (sf === "index.ts" || sf.startsWith("__") || !sf.endsWith(".ts")) continue;
        const subSource = await readFile(join(commandsDir, entry.name, sf), "utf8");

        // Match new Command("name") or .command("name")
        const cmdNameMatch = subSource.match(/new\s+Command\(["'](\w[\w-]*)["']\)/) || subSource.match(/\.command\(["'](\w[\w-]*)["']\)/);
        const aliasMatch2 = subSource.match(/\.alias\(["']([\w-]+)["']\)/);
        const descMatch = subSource.match(/\.description\(["']([^"']+)["']\)/);

        const args = [];
        const argRegex = /\.argument\(["']([^"']+)["'],\s*["']([^"']+)["']\)/g;
        let am;
        while ((am = argRegex.exec(subSource))) {
          args.push({ syntax: am[1], description: am[2] });
        }

        const options = [];
        const optRegex = /\.option\(["']([^"']+)["'],\s*["']([^"']+)["']/g;
        let om;
        while ((om = optRegex.exec(subSource))) {
          options.push({ flags: om[1], description: om[2] });
        }
        const reqOptRegex = /\.requiredOption\(["']([^"']+)["'],\s*["']([^"']+)["']/g;
        while ((om = reqOptRegex.exec(subSource))) {
          options.push({ flags: om[1], description: om[2], required: true });
        }

        if (cmdNameMatch) {
          group.subcommands.push({
            name: cmdNameMatch[1],
            alias: aliasMatch2?.[1] || null,
            description: descMatch?.[1] || "",
            arguments: args,
            options,
          });
        }
      }

      groups.push(group);
    } else if (entry.name.endsWith(".ts") && entry.name !== "index.ts") {
      const source = await readFile(join(commandsDir, entry.name), "utf8");
      const cmdNameMatch = source.match(/new\s+Command\(["'](\w[\w-]*)["']\)/) || source.match(/\.command\(["'](\w[\w-]*)["']\)/);
      const descMatch = source.match(/\.description\(["']([^"']+)["']\)/);

      const args = [];
      const argRegex = /\.argument\(["']([^"']+)["'],\s*["']([^"']+)["']\)/g;
      let am;
      while ((am = argRegex.exec(source))) {
        args.push({ syntax: am[1], description: am[2] });
      }

      const options = [];
      const optRegex = /\.option\(["']([^"']+)["'],\s*["']([^"']+)["']/g;
      let om;
      while ((om = optRegex.exec(source))) {
        options.push({ flags: om[1], description: om[2] });
      }
      const reqOptRegex = /\.requiredOption\(["']([^"']+)["'],\s*["']([^"']+)["']/g;
      while ((om = reqOptRegex.exec(source))) {
        options.push({ flags: om[1], description: om[2], required: true });
      }

      if (cmdNameMatch) {
        groups.push({
          name: cmdNameMatch[1],
          alias: null,
          subcommands: [],
          standalone: true,
          description: descMatch?.[1] || "",
          arguments: args,
          options,
        });
      }
    }
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function extractErrorCodes(source) {
  const codes = [];
  const codeRegex = /(\w+)\s*:\s*(-?\d+)/g;
  const blockMatch = source.match(/RPC_ERROR_CODES\s*=\s*\{([^}]+)\}/s);
  if (blockMatch) {
    let m;
    while ((m = codeRegex.exec(blockMatch[1]))) {
      codes.push({ name: m[1], code: parseInt(m[2]) });
    }
  }
  return codes;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("Generating API surface & config schema snapshots...");

  // --- Read all source files ---
  const [rpcSrc, agentSrc, templateTypeSrc, domainCtxSrc, domainCompSrc, sourceSrc, templateSchemaSrc, metaSchemaSrc, scheduleSchemaSrc] = await Promise.all([
    readFile(PATHS.rpcTypes, "utf8"),
    readFile(PATHS.agentTypes, "utf8"),
    readFile(PATHS.templateTypes, "utf8"),
    readFile(PATHS.domainContextTypes, "utf8"),
    readFile(PATHS.domainComponentTypes, "utf8"),
    readFile(PATHS.sourceTypes, "utf8"),
    readFile(PATHS.templateSchema, "utf8"),
    readFile(PATHS.instanceMetaSchema, "utf8"),
    readFile(PATHS.scheduleConfigSchema, "utf8"),
  ]);

  // --- Extract data ---
  const rpcMethods = extractRpcMethods(rpcSrc);
  const rpcInterfaces = extractInterfaces(rpcSrc);
  const errorCodes = extractErrorCodes(rpcSrc);
  const cliCommands = await extractCliCommands(PATHS.cliCommands);

  const agentInterfaces = extractInterfaces(agentSrc);
  const agentEnums = extractEnums(agentSrc);
  const templateInterfaces = extractInterfaces(templateTypeSrc);
  const domainCtxInterfaces = extractInterfaces(domainCtxSrc);
  const domainCompInterfaces = extractInterfaces(domainCompSrc);
  const sourceInterfaces = extractInterfaces(sourceSrc);

  const templateSchemas = extractZodSchemas(templateSchemaSrc);
  const metaSchemas = extractZodSchemas(metaSchemaSrc);
  const scheduleSchemas = extractZodSchemas(scheduleSchemaSrc);

  // --- Build API surface JSON ---
  const apiJson = {
    version: "v0.1.0",
    date: new Date().toISOString(),
    rpc: {
      protocol: "JSON-RPC 2.0",
      methodCount: rpcMethods.length,
      methods: rpcMethods,
      errorCodes,
    },
    cli: {
      binary: "actant",
      groupCount: cliCommands.filter(c => !c.standalone).length,
      standaloneCount: cliCommands.filter(c => c.standalone).length,
      totalSubcommands: cliCommands.reduce((n, g) => n + (g.subcommands?.length || (g.standalone ? 1 : 0)), 0),
      commands: cliCommands,
    },
    paramTypes: rpcInterfaces.filter(i => i.name.endsWith("Params")).map(i => ({ name: i.name, fields: i.fields })),
    resultTypes: rpcInterfaces.filter(i => i.name.endsWith("Result") || i.name.endsWith("Info")).map(i => ({ name: i.name, fields: i.fields })),
  };

  // --- Build config schema JSON ---
  const configJson = {
    version: "v0.1.0",
    date: new Date().toISOString(),
    zodSchemas: {
      template: templateSchemas,
      instanceMeta: metaSchemas,
      schedule: scheduleSchemas,
    },
    typeInterfaces: {
      agent: agentInterfaces,
      template: templateInterfaces,
      domainContext: domainCtxInterfaces,
      domainComponent: domainCompInterfaces,
      source: sourceInterfaces,
    },
    enums: {
      agent: agentEnums,
    },
  };

  // --- Write JSON files ---
  await writeFile(join(outputDir, "api-surface.json"), JSON.stringify(apiJson, null, 2) + "\n");
  await writeFile(join(outputDir, "config-schemas.json"), JSON.stringify(configJson, null, 2) + "\n");

  // --- Generate api-surface.md ---
  const apiMd = generateApiMd(apiJson, rpcInterfaces);
  await writeFile(join(outputDir, "api-surface.md"), apiMd);

  // --- Generate config-schemas.md ---
  const configMd = generateConfigMd(configJson);
  await writeFile(join(outputDir, "config-schemas.md"), configMd);

  console.log(`✓ api-surface.md    (${rpcMethods.length} RPC methods, ${apiJson.cli.totalSubcommands} CLI commands)`);
  console.log(`✓ api-surface.json`);
  console.log(`✓ config-schemas.md (${templateSchemas.length + metaSchemas.length + scheduleSchemas.length} Zod schemas, ${agentInterfaces.length + templateInterfaces.length + domainCtxInterfaces.length + domainCompInterfaces.length + sourceInterfaces.length} interfaces)`);
  console.log(`✓ config-schemas.json`);
  console.log(`  Output: ${outputDir}`);
}

// =============================================================================
// Markdown Generators
// =============================================================================

function generateApiMd(api, rpcInterfaces) {
  const lines = [];
  const w = (...args) => lines.push(args.join(""));

  w("# API Surface Snapshot");
  w("");
  w(`> **版本**: ${api.version} | **生成时间**: ${api.date}`);
  w("> 本文档记录所有对外接口（RPC 方法、CLI 命令），用于版本间变更追踪。");
  w("");
  w("---");
  w("");

  // --- RPC Methods ---
  w("## 1. JSON-RPC 方法 (", String(api.rpc.methodCount), " 个)");
  w("");

  const groups = {};
  for (const m of api.rpc.methods) {
    const [ns] = m.method.split(".");
    if (!groups[ns]) groups[ns] = [];
    groups[ns].push(m);
  }

  for (const [ns, methods] of Object.entries(groups)) {
    w(`### ${ns}.*`);
    w("");
    w("| 方法 | Params 类型 | Result 类型 |");
    w("|------|-----------|-----------|");
    for (const m of methods) {
      w(`| \`${m.method}\` | \`${m.paramsType}\` | \`${m.resultType}\` |`);
    }
    w("");
  }

  // --- RPC Param/Result Type Details ---
  w("## 2. RPC 类型签名");
  w("");
  w("### Params 类型");
  w("");

  const paramTypes = rpcInterfaces.filter(i => i.name.endsWith("Params"));
  for (const iface of paramTypes) {
    if (iface.fields.length === 0) continue;
    w(`#### \`${iface.name}\``);
    w("");
    w("| 字段 | 类型 | 必需 |");
    w("|------|------|------|");
    for (const f of iface.fields) {
      w(`| \`${f.name}\` | \`${f.type}\` | ${f.optional ? "否" : "是"} |`);
    }
    w("");
  }

  w("### Result 类型");
  w("");

  const resultTypes = rpcInterfaces.filter(i => i.name.endsWith("Result") || i.name === "SessionLeaseInfo" || i.name === "ProxySession");
  for (const iface of resultTypes) {
    if (iface.fields.length === 0) continue;
    w(`#### \`${iface.name}\``);
    w("");
    w("| 字段 | 类型 | 必需 |");
    w("|------|------|------|");
    for (const f of iface.fields) {
      w(`| \`${f.name}\` | \`${f.type}\` | ${f.optional ? "否" : "是"} |`);
    }
    w("");
  }

  // --- Error Codes ---
  w("## 3. 错误码");
  w("");
  w("| 名称 | 代码 |");
  w("|------|------|");
  for (const e of api.rpc.errorCodes) {
    w(`| \`${e.name}\` | ${e.code} |`);
  }
  w("");

  // --- CLI Commands ---
  w("## 4. CLI 命令 (", String(api.cli.totalSubcommands), " 个)");
  w("");
  w(`二进制入口: \`${api.cli.binary}\``);
  w("");

  for (const group of api.cli.commands) {
    if (group.standalone) {
      w(`### ${group.name} (独立命令)`);
      w("");
      w(`描述: ${group.description || "—"}`);
      if (group.arguments?.length) {
        w("");
        w("**参数:**");
        for (const a of group.arguments) w(`- \`${a.syntax}\` — ${a.description}`);
      }
      if (group.options?.length) {
        w("");
        w("**选项:**");
        for (const o of group.options) w(`- \`${o.flags}\` — ${o.description}`);
      }
      w("");
      continue;
    }

    const aliasStr = group.alias ? ` (alias: ${group.alias})` : "";
    w(`### ${group.name}${aliasStr}`);
    w("");

    if (group.subcommands.length === 0) {
      w("_无子命令_");
      w("");
      continue;
    }

    w("| 子命令 | 别名 | 说明 | 参数 | 选项 |");
    w("|--------|------|------|------|------|");
    for (const sub of group.subcommands) {
      const argsStr = sub.arguments.map(a => `\`${a.syntax}\``).join(", ") || "—";
      const optsStr = sub.options.map(o => `\`${o.flags}\`${o.required ? " *" : ""}`).join(", ") || "—";
      w(`| \`${sub.name}\` | ${sub.alias || "—"} | ${sub.description} | ${argsStr} | ${optsStr} |`);
    }
    w("");
  }

  return lines.join("\n") + "\n";
}

function generateConfigMd(config) {
  const lines = [];
  const w = (...args) => lines.push(args.join(""));

  w("# Config Schema Snapshot");
  w("");
  w(`> **版本**: ${config.version} | **生成时间**: ${config.date}`);
  w("> 本文档记录所有配置结构（Zod Schema + TypeScript 接口），用于版本间变更追踪。");
  w("");
  w("---");
  w("");

  // --- Zod Schemas ---
  w("## 1. Zod Schemas（运行时校验）");
  w("");

  const schemaGroups = [
    ["AgentTemplate 模板结构", config.zodSchemas.template],
    ["AgentInstanceMeta 实例元数据", config.zodSchemas.instanceMeta],
    ["ScheduleConfig 调度配置", config.zodSchemas.schedule],
  ];

  for (const [title, schemas] of schemaGroups) {
    w(`### ${title}`);
    w("");
    for (const schema of schemas) {
      w(`#### \`${schema.name}\` (${schema.kind})`);
      w("");
      if (schema.kind === "object" && schema.fields.length > 0) {
        w("| 字段 | Zod 类型 |");
        w("|------|---------|");
        for (const f of schema.fields) {
          w(`| \`${f.name}\` | \`${f.zodType}\` |`);
        }
      } else if (schema.kind === "enum") {
        const vals = schema.fields[0]?.zodType || "";
        w(`值: \`${vals}\``);
      }
      w("");
    }
  }

  // --- TypeScript Interfaces ---
  w("## 2. TypeScript 接口（类型定义）");
  w("");

  const ifaceGroups = [
    ["Agent 实例类型", config.typeInterfaces.agent],
    ["Template 模板类型", config.typeInterfaces.template],
    ["DomainContext 领域上下文", config.typeInterfaces.domainContext],
    ["DomainComponent 领域组件", config.typeInterfaces.domainComponent],
    ["Source 组件源", config.typeInterfaces.source],
  ];

  for (const [title, interfaces] of ifaceGroups) {
    w(`### ${title}`);
    w("");
    for (const iface of interfaces) {
      w(`#### \`${iface.name}\``);
      w("");
      if (iface.fields.length > 0) {
        w("| 字段 | 类型 | 必需 |");
        w("|------|------|------|");
        for (const f of iface.fields) {
          w(`| \`${f.name}\` | \`${f.type}\` | ${f.optional ? "否" : "是"} |`);
        }
      } else if (iface.raw) {
        w("```typescript");
        w(`type ${iface.name} = ${iface.raw}`);
        w("```");
      }
      w("");
    }
  }

  // --- Enums ---
  if (config.enums.agent?.length) {
    w("## 3. 枚举值");
    w("");
    for (const e of config.enums.agent) {
      w(`### \`${e.name}\``);
      w("");
      w("值: " + e.values.map(v => `\`${v}\``).join(" | "));
      w("");
    }
  }

  return lines.join("\n") + "\n";
}

main().catch(e => { console.error(e); process.exit(1); });
