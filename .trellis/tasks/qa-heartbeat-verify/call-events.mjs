/**
 * 通过 IPC 直接调用 events.recent RPC，输出原始事件日志
 * 用法: node call-events.mjs [limit]
 * 依赖环境变量: ACTANT_HOME
 */
import { createConnection } from "node:net";
import { randomUUID, createHash } from "node:crypto";

function getIpcPath(homeDir) {
  if (process.platform === "win32") {
    const raw = homeDir.replace(/[^a-zA-Z0-9._-]/g, "_");
    const MAX_SAFE_LEN = 80;
    const safeName = raw.length > MAX_SAFE_LEN
      ? raw.slice(0, 48) + "-" + createHash("md5").update(homeDir).digest("hex").slice(0, 16)
      : raw;
    return `\\\\.\\pipe\\actant-${safeName}`;
  }
  return homeDir + "/actant.sock";
}

const homeDir = process.env.ACTANT_HOME;
if (!homeDir) { console.error("ACTANT_HOME not set"); process.exit(1); }

const socketPath = process.env.ACTANT_SOCKET ?? getIpcPath(homeDir);
const limit = parseInt(process.argv[2] ?? "200");
const filterEvent = process.argv[3]; // optional: filter by event prefix

const req = {
  jsonrpc: "2.0",
  id: randomUUID(),
  method: "events.recent",
  params: { limit },
};

console.error(`Connecting to: ${socketPath}`);
const sock = createConnection(socketPath);
let buf = "";

sock.on("connect", () => {
  sock.write(JSON.stringify(req) + "\n");
});

sock.on("data", (chunk) => {
  buf += chunk.toString();
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const res = JSON.parse(line);
      if (res.result) {
        let events = res.result.events ?? [];
        if (filterEvent) {
          events = events.filter(e => e.event.startsWith(filterEvent));
        }
        console.log(JSON.stringify(events, null, 2));
        console.error(`\nTotal: ${events.length} events${filterEvent ? ` matching "${filterEvent}"` : ""}`);
      } else if (res.error) {
        console.error("RPC Error:", JSON.stringify(res.error));
      }
    } catch {
      // ignore non-JSON
    }
    sock.end();
  }
});

sock.on("error", (err) => {
  console.error("Socket error:", err.message);
  process.exit(1);
});

sock.on("close", () => process.exit(0));
setTimeout(() => { console.error("Timeout"); process.exit(1); }, 5000);
