import { findOpenspecRoot } from "../../src/openspec/discover.js";
import type { CommandRunner } from "../../src/openspec/mutate.js";
import type { WatchFactory } from "../../src/openspec/watch.js";
import { startServer, type ServerOptions } from "../../src/server.js";
import { settleCleanup } from "./cleanup.js";
import { createTestProject } from "./fixture.js";

export type TestServer = {
  projectDir: string;
  url: string;
  close: () => Promise<void>;
};

export type TestServerOptions = {
  includeArchive?: boolean;
  runCommand?: CommandRunner;
  watchFactory?: WatchFactory;
  watchDebounceMs?: number;
};

export async function startTestServer(
  options: TestServerOptions = {},
): Promise<TestServer> {
  const project = createTestProject();

  try {
    const root = findOpenspecRoot(project.projectDir);
    const serverOptions: ServerOptions & TestServerOptions = {
      root,
      host: "127.0.0.1",
      port: 0,
      ...options,
    };
    const server = await startServer(serverOptions);

    return {
      projectDir: project.projectDir,
      url: server.url,
      close: async () => {
        try {
          await server.close();
        } finally {
          project.cleanup();
        }
      },
    };
  } catch (error) {
    project.cleanup();
    throw error;
  }
}

export async function withTestServer<T>(
  callback: (server: TestServer) => Promise<T>,
  options: TestServerOptions = {},
): Promise<T> {
  const server = await startTestServer(options);
  try {
    return await callback(server);
  } finally {
    await server.close();
  }
}

export async function closeTestServers(servers: TestServer[]): Promise<void> {
  const owned = servers.splice(0);
  await settleCleanup(
    owned.map((server) => () => server.close()),
    "Test server",
  );
}
