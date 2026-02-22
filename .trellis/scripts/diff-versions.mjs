#!/usr/bin/env node
/**
 * Diff two staged versions — API surface & config schema changes.
 *
 * Compares the JSON snapshots between two versions and outputs a structured
 * change report highlighting: added/removed/modified RPC methods, CLI commands,
 * config fields, and type interfaces.
 *
 * Usage: node diff-versions.mjs <v1> <v2> [--output <file>]
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const STAGE_DIR = join(ROOT, "docs", "stage");

const v1 = process.argv[2];
const v2 = process.argv[3];
const outputIdx = process.argv.indexOf("--output");
const outputFile = outputIdx !== -1 ? process.argv[outputIdx + 1] : null;

if (!v1 || !v2) {
  console.error("Usage: diff-versions.mjs <v1> <v2> [--output <file>]");
  console.error("Example: diff-versions.mjs v0.1.0 v0.2.0");
  process.exit(1);
}

async function loadJson(version, filename) {
  const path = join(STAGE_DIR, version, filename);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function diffArrayByKey(oldArr, newArr, keyFn) {
  const oldMap = new Map(oldArr.map(item => [keyFn(item), item]));
  const newMap = new Map(newArr.map(item => [keyFn(item), item]));

  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, item] of newMap) {
    if (!oldMap.has(key)) {
      added.push(item);
    } else {
      const oldItem = oldMap.get(key);
      if (JSON.stringify(oldItem) !== JSON.stringify(item)) {
        modified.push({ old: oldItem, new: item, key });
      }
    }
  }

  for (const [key, item] of oldMap) {
    if (!newMap.has(key)) {
      removed.push(item);
    }
  }

  return { added, removed, modified };
}

function diffFields(oldFields, newFields) {
  return diffArrayByKey(oldFields || [], newFields || [], f => f.name);
}

async function main() {
  const [api1, api2, cfg1, cfg2] = await Promise.all([
    loadJson(v1, "api-surface.json"),
    loadJson(v2, "api-surface.json"),
    loadJson(v1, "config-schemas.json"),
    loadJson(v2, "config-schemas.json"),
  ]);

  const lines = [];
  const w = (...args) => lines.push(args.join(""));
  let hasChanges = false;

  w(`# Version Diff: ${v1} → ${v2}`);
  w("");
  w(`> 生成时间: ${new Date().toISOString()}`);
  w("");
  w("---");
  w("");

  // === API Surface Diff ===
  if (api1 && api2) {
    w("## 1. RPC 方法变更");
    w("");

    const rpcDiff = diffArrayByKey(
      api1.rpc.methods, api2.rpc.methods, m => m.method
    );

    if (rpcDiff.added.length) {
      hasChanges = true;
      w("### 新增方法");
      w("");
      for (const m of rpcDiff.added) {
        w(`- **\`${m.method}\`** — Params: \`${m.paramsType}\`, Result: \`${m.resultType}\``);
      }
      w("");
    }

    if (rpcDiff.removed.length) {
      hasChanges = true;
      w("### ⚠️ 移除方法 (Breaking Change)");
      w("");
      for (const m of rpcDiff.removed) {
        w(`- ~~\`${m.method}\`~~ — Params: \`${m.paramsType}\`, Result: \`${m.resultType}\``);
      }
      w("");
    }

    if (rpcDiff.modified.length) {
      hasChanges = true;
      w("### 签名变更");
      w("");
      for (const m of rpcDiff.modified) {
        w(`#### \`${m.key}\``);
        if (m.old.paramsType !== m.new.paramsType) {
          w(`- Params: \`${m.old.paramsType}\` → \`${m.new.paramsType}\``);
        }
        if (m.old.resultType !== m.new.resultType) {
          w(`- Result: \`${m.old.resultType}\` → \`${m.new.resultType}\``);
        }
        w("");
      }
    }

    if (!rpcDiff.added.length && !rpcDiff.removed.length && !rpcDiff.modified.length) {
      w("_无变更_");
      w("");
    }

    // --- Param/Result type field changes ---
    w("## 2. RPC 类型字段变更");
    w("");

    const paramDiff = diffArrayByKey(api1.paramTypes, api2.paramTypes, t => t.name);
    const resultDiff = diffArrayByKey(api1.resultTypes, api2.resultTypes, t => t.name);

    for (const section of [
      { label: "Params", diff: paramDiff },
      { label: "Result", diff: resultDiff },
    ]) {
      if (section.diff.added.length) {
        hasChanges = true;
        w(`### 新增 ${section.label} 类型`);
        w("");
        for (const t of section.diff.added) w(`- \`${t.name}\``);
        w("");
      }
      if (section.diff.removed.length) {
        hasChanges = true;
        w(`### ⚠️ 移除 ${section.label} 类型`);
        w("");
        for (const t of section.diff.removed) w(`- ~~\`${t.name}\`~~`);
        w("");
      }
      if (section.diff.modified.length) {
        hasChanges = true;
        w(`### ${section.label} 类型字段变更`);
        w("");
        for (const m of section.diff.modified) {
          const fd = diffFields(m.old.fields, m.new.fields);
          if (fd.added.length || fd.removed.length || fd.modified.length) {
            w(`#### \`${m.key}\``);
            for (const f of fd.added) w(`- ➕ \`${f.name}: ${f.type}\`${f.optional ? " (可选)" : ""}`);
            for (const f of fd.removed) w(`- ⚠️ ➖ ~~\`${f.name}\`~~`);
            for (const f of fd.modified) {
              w(`- 🔄 \`${f.key}\`: \`${f.old.type}\` → \`${f.new.type}\``);
            }
            w("");
          }
        }
      }
    }

    // --- CLI command changes ---
    w("## 3. CLI 命令变更");
    w("");

    const flattenCli = (commands) => {
      const flat = [];
      for (const g of commands) {
        if (g.standalone) {
          flat.push({ fullName: g.name, ...g });
        } else {
          for (const sub of (g.subcommands || [])) {
            flat.push({ fullName: `${g.name} ${sub.name}`, group: g.name, ...sub });
          }
        }
      }
      return flat;
    };

    const cliDiff = diffArrayByKey(
      flattenCli(api1.cli.commands),
      flattenCli(api2.cli.commands),
      c => c.fullName
    );

    if (cliDiff.added.length) {
      hasChanges = true;
      w("### 新增命令");
      w("");
      for (const c of cliDiff.added) w(`- \`agentcraft ${c.fullName}\` — ${c.description || ""}`);
      w("");
    }

    if (cliDiff.removed.length) {
      hasChanges = true;
      w("### ⚠️ 移除命令 (Breaking Change)");
      w("");
      for (const c of cliDiff.removed) w(`- ~~\`agentcraft ${c.fullName}\`~~`);
      w("");
    }

    if (cliDiff.modified.length) {
      hasChanges = true;
      w("### 命令签名变更");
      w("");
      for (const m of cliDiff.modified) {
        w(`- \`agentcraft ${m.key}\``);
        const oldOpts = new Set((m.old.options || []).map(o => o.flags));
        const newOpts = new Set((m.new.options || []).map(o => o.flags));
        for (const o of m.new.options || []) {
          if (!oldOpts.has(o.flags)) w(`  - ➕ 选项 \`${o.flags}\``);
        }
        for (const o of m.old.options || []) {
          if (!newOpts.has(o.flags)) w(`  - ➖ 选项 ~~\`${o.flags}\`~~`);
        }
      }
      w("");
    }

    if (!cliDiff.added.length && !cliDiff.removed.length && !cliDiff.modified.length) {
      w("_无变更_");
      w("");
    }

    // --- Error code changes ---
    w("## 4. 错误码变更");
    w("");
    const errDiff = diffArrayByKey(api1.rpc.errorCodes, api2.rpc.errorCodes, e => e.name);
    if (errDiff.added.length) {
      hasChanges = true;
      for (const e of errDiff.added) w(`- ➕ \`${e.name}\` (${e.code})`);
    }
    if (errDiff.removed.length) {
      hasChanges = true;
      for (const e of errDiff.removed) w(`- ⚠️ ➖ ~~\`${e.name}\`~~`);
    }
    if (!errDiff.added.length && !errDiff.removed.length) {
      w("_无变更_");
    }
    w("");
  } else {
    w("## API Surface");
    w("");
    w(`_缺少 JSON 快照: ${!api1 ? v1 : v2}_`);
    w("");
  }

  // === Config Schema Diff ===
  if (cfg1 && cfg2) {
    w("---");
    w("");
    w("## 5. Zod Schema 变更");
    w("");

    for (const groupKey of ["template", "instanceMeta", "schedule"]) {
      const old = cfg1.zodSchemas[groupKey] || [];
      const cur = cfg2.zodSchemas[groupKey] || [];
      const diff = diffArrayByKey(old, cur, s => s.name);

      if (diff.added.length || diff.removed.length || diff.modified.length) {
        hasChanges = true;
        w(`### ${groupKey}`);
        w("");
        for (const s of diff.added) w(`- ➕ \`${s.name}\``);
        for (const s of diff.removed) w(`- ⚠️ ➖ ~~\`${s.name}\`~~`);
        for (const m of diff.modified) {
          const fd = diffArrayByKey(m.old.fields || [], m.new.fields || [], f => f.name);
          w(`#### \`${m.key}\``);
          for (const f of fd.added) w(`- ➕ \`${f.name}: ${f.zodType}\``);
          for (const f of fd.removed) w(`- ⚠️ ➖ ~~\`${f.name}\`~~`);
          for (const f of fd.modified) w(`- 🔄 \`${f.key}\`: \`${f.old.zodType}\` → \`${f.new.zodType}\``);
          w("");
        }
      }
    }

    w("## 6. TypeScript 接口变更");
    w("");

    for (const groupKey of ["agent", "template", "domainContext", "domainComponent", "source"]) {
      const old = cfg1.typeInterfaces[groupKey] || [];
      const cur = cfg2.typeInterfaces[groupKey] || [];
      const diff = diffArrayByKey(old, cur, i => i.name);

      if (diff.added.length || diff.removed.length || diff.modified.length) {
        hasChanges = true;
        w(`### ${groupKey}`);
        w("");
        for (const i of diff.added) w(`- ➕ \`${i.name}\``);
        for (const i of diff.removed) w(`- ⚠️ ➖ ~~\`${i.name}\`~~`);
        for (const m of diff.modified) {
          const fd = diffFields(m.old.fields, m.new.fields);
          if (fd.added.length || fd.removed.length || fd.modified.length) {
            w(`#### \`${m.key}\``);
            for (const f of fd.added) w(`- ➕ \`${f.name}: ${f.type}\`${f.optional ? " (可选)" : ""}`);
            for (const f of fd.removed) w(`- ⚠️ ➖ ~~\`${f.name}\`~~`);
            for (const f of fd.modified) w(`- 🔄 \`${f.key}\`: \`${f.old.type}\` → \`${f.new.type}\``);
            w("");
          }
        }
      }
    }
  }

  // --- Summary ---
  w("---");
  w("");
  w("## 变更摘要");
  w("");
  if (hasChanges) {
    w(`本次版本升级 (${v1} → ${v2}) 包含对外接口或配置结构变更，请仔细审查上述标记为 ⚠️ 的 breaking change。`);
  } else {
    w(`本次版本升级 (${v1} → ${v2}) 未检测到对外接口或配置结构变更。`);
  }
  w("");

  const output = lines.join("\n");

  if (outputFile) {
    await writeFile(outputFile, output);
    console.log(`✓ Diff report written to: ${outputFile}`);
  } else {
    console.log(output);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
