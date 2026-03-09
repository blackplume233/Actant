/**
 * 通过 IPC 发送自定义 RPC 调用，或通过其他方式触发 process:crash 事件
 * 
 * 由于 events.recent 是只读的，我们无法通过 RPC 直接注入事件。
 * 改为：启动一个 agent 然后用 SIGKILL 杀死它来触发真实的 process:crash。
 * 
 * 这里先查询当前 agent 列表
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

const method = process.argv[2] ?? "agent.list";
const params = process.argv[3] ? JSON.parse(process.argv[3]) : {};

const req = { jsonrpc: "2.0", id: randomUUID(), method, params };

const sock = createConnection(socketPath);
let buf = "";

sock.on("connect", () => sock.write(JSON.stringify(req) + "\n"));
sock.on("data", (chunk) => {
  buf += chunk.toString();
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const res = JSON.parse(line);
      console.log(JSON.stringify(res.result ?? res.error, null, 2));
    } catch { }
    sock.end();
  }
});
sock.on("error", (err) => { console.error("Error:", err.message); process.exit(1); });
sock.on("close", () => process.exit(0));
setTimeout(() => { console.error("Timeout"); process.exit(1); }, 5000);
