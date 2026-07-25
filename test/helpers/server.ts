import { findOpenspecRoot } from "../../src/openspec/discover.js";
import { startServer } from "../../src/server.js";
import { createTestProject } from "./fixture.js";

export type TestServer = {
  projectDir: string;
  url: string;
  close: () => Promise<void>;
};

export async function startTestServer(): Promise<TestServer> {
  const project = createTestProject();

  try {
    const root = findOpenspecRoot(project.projectDir);
    const server = await startServer({ root, host: "127.0.0.1", port: 0 });

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
