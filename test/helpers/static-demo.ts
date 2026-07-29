import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { extname, join } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export type StaticDemoServer = {
  url: string;
  requests: Array<{ method: string; pathname: string }>;
  close: () => Promise<void>;
};

export async function startStaticDemoServer(
  rootDir = join(process.cwd(), "dist", "hosted-demo"),
): Promise<StaticDemoServer> {
  const basePath = "/openspec-viewer/";
  const requests: Array<{ method: string; pathname: string }> = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    requests.push({
      method: request.method ?? "GET",
      pathname: url.pathname,
    });

    if (!url.pathname.startsWith(basePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const relative = url.pathname.slice(basePath.length) || "index.html";
    if (relative.includes("..")) {
      response.writeHead(400);
      response.end("Invalid path");
      return;
    }
    const filePath = join(rootDir, relative);
    if (!existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(readFileSync(filePath));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  let closePromise: Promise<void> | undefined;

  return {
    url: `http://127.0.0.1:${address.port}${basePath}`,
    requests,
    close: () => {
      closePromise ??= new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      return closePromise;
    },
  };
}
