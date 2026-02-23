import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const ACTANT = "node packages/cli/dist/bin/actant.js";
const LOG_FILE = ".trellis/tasks/02-22-qaloop-web-search-interval/qa-log-round2.md";
const INTERVAL_SEC = 60;

const rounds = [
  { id: "R01-sports", prompt: "Search the web for: 2026 FIFA World Cup qualifiers latest results. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R02-finance", prompt: "Search the web for: global stock market trends February 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R03-medical", prompt: "Search the web for: mRNA vaccine developments beyond COVID 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R04-carbon", prompt: "Search the web for: carbon capture technology breakthroughs 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R05-jwst", prompt: "Search the web for: James Webb Space Telescope latest discoveries 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R06-empty", prompt: "Search the web for nothing specific. Give a 2-3 sentence summary of any trending news.", maxTurns: 3 },
  { id: "R07-chinese", prompt: "Search the web for: China AI industry trends 2026 in Chinese perspective. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R08-long", prompt: "Search the web for: latest developments in artificial general intelligence research including new architectures beyond transformers novel training paradigms emergent capabilities scaling laws and safety alignment techniques in 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R09-robotics", prompt: "Search the web for: humanoid robot progress Tesla Optimus Figure 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R10-battery", prompt: "Search the web for: solid state battery commercialization timeline Toyota Samsung 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R11-emoji", prompt: "Search the web for: rocket launches 2026 moon missions space exploration. Give a 2-3 sentence summary.", maxTurns: 5 },
  { id: "R12-bci", prompt: "Search the web for: brain computer interface consumer products Neuralink 2026. Give a 2-3 sentence summary.", maxTurns: 5 },
];

function sleep(sec) {
  return new Promise(r => setTimeout(r, sec * 1000));
}

function log(text) {
  appendFileSync(LOG_FILE, text + "\n");
  console.log(text);
}

async function run() {
  const results = [];
  
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    const start = Date.now();
    log(`\n### [${r.id}] Round ${i + 1}/12`);
    log(`**时间**: ${new Date().toISOString()}`);
    log(`\n#### 输入\n\`\`\`\nagent run qa-web-searcher --prompt "${r.prompt.slice(0, 60)}..." --max-turns ${r.maxTurns} --timeout 120000\n\`\`\``);
    
    let output = "";
    let exitCode = 0;
    try {
      output = execSync(
        `${ACTANT} agent run qa-web-searcher --prompt "${r.prompt}" --max-turns ${r.maxTurns} --timeout 120000`,
        { encoding: "utf-8", timeout: 150000, env: process.env }
      );
    } catch (err) {
      exitCode = err.status ?? 1;
      output = (err.stdout ?? "") + (err.stderr ?? "");
    }
    
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const isSuccess = output.includes('"subtype":"success"');
    const isMaxTurns = output.includes('"subtype":"error_max_turns"');
    const costMatch = output.match(/"total_cost_usd":([0-9.]+)/);
    const cost = costMatch ? parseFloat(costMatch[1]).toFixed(3) : "?";
    
    let verdict = "FAIL";
    if (isSuccess) verdict = "PASS";
    else if (isMaxTurns) verdict = "WARN";
    
    const resultText = output.match(/"result":"([^"]{0,200})/)?.[1]?.replace(/\\n/g, " ") ?? "(no result text)";
    
    log(`\n#### 输出\n\`\`\`\nexit_code: ${exitCode}\nduration: ${duration}s\ncost: $${cost}\nverdict: ${verdict}\nresult_preview: ${resultText.slice(0, 150)}...\n\`\`\``);
    log(`\n#### 判断: ${verdict}`);
    
    results.push({ round: i + 1, id: r.id, verdict, duration, cost });
    
    if (i < rounds.length - 1) {
      log(`\n*等待 ${INTERVAL_SEC}s...*`);
      await sleep(INTERVAL_SEC);
    }
  }
  
  const pass = results.filter(r => r.verdict === "PASS").length;
  const warn = results.filter(r => r.verdict === "WARN").length;
  const fail = results.filter(r => r.verdict === "FAIL").length;
  
  console.log("\n=== LONG LOOP SUMMARY ===");
  console.log(`PASS: ${pass}  WARN: ${warn}  FAIL: ${fail}  Total: ${results.length}`);
  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
