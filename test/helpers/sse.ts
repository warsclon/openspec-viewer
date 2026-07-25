import type { TestServer } from "./server.js";
import { settleCleanup } from "./cleanup.js";

export type SseEvent = {
  event: string;
  data: unknown;
};

export type SseClient = {
  status: number;
  next: (timeoutMs?: number) => Promise<SseEvent>;
  close: () => Promise<void>;
};

export async function connectSse(url: string): Promise<SseClient> {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!response.body) {
    controller.abort();
    throw new Error("SSE response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let closed = false;

  const readEvent = async (): Promise<SseEvent> => {
    while (true) {
      const separator = buffer.indexOf("\n\n");
      if (separator >= 0) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const lines = block.split("\n");
        const event = lines
          .find((line) => line.startsWith("event:"))
          ?.slice("event:".length)
          .trim();
        const data = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trimStart())
          .join("\n");
        if (!event) continue;
        return {
          event,
          data: data ? JSON.parse(data) : null,
        };
      }

      const chunk = await reader.read();
      if (chunk.done) {
        throw new Error("SSE stream closed before the next event");
      }
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
    }
  };

  return {
    status: response.status,
    next: async (timeoutMs = 3000) => {
      let timeout: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          readEvent(),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(
              () => reject(new Error(`Timed out waiting for SSE event after ${timeoutMs}ms`)),
              timeoutMs,
            );
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
    close: async () => {
      if (closed) return;
      closed = true;
      controller.abort();
      try {
        await reader.cancel();
      } catch {
        // Aborting an active fetch can reject the stream.
      }
    },
  };
}

export async function closeSseClients(clients: SseClient[]): Promise<void> {
  const owned = clients.splice(0);
  await settleCleanup(
    owned.map((client) => () => client.close()),
    "SSE client",
  );
}

export async function closeSseTestResources(
  clients: SseClient[],
  servers: TestServer[],
): Promise<void> {
  const ownedClients = clients.splice(0);
  const ownedServers = servers.splice(0);
  await settleCleanup(
    [
      ...ownedClients.map((client) => () => client.close()),
      ...ownedServers.map((server) => () => server.close()),
    ],
    "SSE test resource",
  );
}
