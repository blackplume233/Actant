import type { ServerResponse } from "node:http";
import type { RpcBridge } from "../rpc-bridge";

export function handleSSE(bridge: RpcBridge, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const poll = async () => {
    const [statusR, agentsR, eventsR, canvasR] = await Promise.allSettled([
      bridge.call("daemon.ping"),
      bridge.call("agent.list"),
      bridge.call("events.recent", { limit: 50 }),
      bridge.call("canvas.list"),
    ]);

    if (statusR.status === "fulfilled") {
      send("status", statusR.value);
    } else {
      send("error", { message: "Daemon connection lost" });
      return;
    }

    if (agentsR.status === "fulfilled") send("agents", agentsR.value);
    if (eventsR.status === "fulfilled") send("events", eventsR.value);
    else send("events", { events: [] });
    if (canvasR.status === "fulfilled") send("canvas", canvasR.value);
  };

  poll();
  const timer = setInterval(poll, 2000);

  res.on("close", () => {
    clearInterval(timer);
  });
}
