/**
 * Transport abstraction layer for Dashboard data communication.
 * WebTransport uses HTTP + SSE (browser); TauriTransport (future) uses Tauri IPC.
 */

export type TransportEventHandler = (event: string, data: unknown) => void;

export interface Transport {
  fetch<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  subscribe(onData: TransportEventHandler): () => void;
}

/**
 * Web-based transport: REST for fetch, SSE for subscribe.
 */
export class WebTransport implements Transport {
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  async fetch<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/v1/${method.replace(/\./g, "/")}`;
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      }, {}),
    ).toString() : "";
    const res = await globalThis.fetch(url + qs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  subscribe(onData: TransportEventHandler): () => void {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      es?.close();

      es = new EventSource(`${this.baseUrl}/v1/sse`);

      const events = ["status", "agents", "events", "canvas", "error"];
      for (const evt of events) {
        es.addEventListener(evt, (e) => {
          try {
            onData(evt, JSON.parse((e as MessageEvent).data));
          } catch { /* ignore parse failures */ }
        });
      }

      es.onerror = () => {
        es?.close();
        onData("disconnect", null);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }
}
