import { existsSync } from "node:fs";
import {
  test as base,
  type Page,
} from "@playwright/test";
import {
  startTestServer,
  type TestServer,
} from "../helpers/server.js";

export type BrowserApp = {
  page: Page;
  projectDir: string;
  server: TestServer;
  url: string;
};

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export const test = base.extend<{ app: BrowserApp }>({
  app: async ({ page }, use) => {
    const server = await startTestServer({
      runCommand: async () => {
        const error = new Error("OpenSpec CLI is unavailable in browser tests");
        Object.assign(error, { code: "ENOENT" });
        throw error;
      },
    });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    let testError: Error | undefined;
    try {
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });
      await page.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === server.url) {
          await route.continue();
          return;
        }
        externalRequests.push(requestUrl.href);
        await route.abort("blockedbyclient");
      });

      await use({
        page,
        projectDir: server.projectDir,
        server,
        url: server.url,
      });
    } catch (error) {
      testError = asError(error);
    }

    const failures = testError ? [testError] : [];
    try {
      await page.close({ runBeforeUnload: false });
    } catch (error) {
      failures.push(asError(error));
    }
    try {
      await server.close();
    } catch (error) {
      failures.push(asError(error));
    }
    if (consoleErrors.length) {
      failures.push(
        new Error(
          `Unexpected browser console errors:\n${consoleErrors.join("\n")}`,
        ),
      );
    }
    if (pageErrors.length) {
      failures.push(
        new Error(`Unexpected uncaught page errors:\n${pageErrors.join("\n")}`),
      );
    }
    if (externalRequests.length) {
      failures.push(
        new Error(
          `Unexpected external browser requests:\n${externalRequests.join("\n")}`,
        ),
      );
    }
    if (existsSync(server.projectDir)) {
      failures.push(
        new Error(
          `Isolated browser fixture was not removed: ${server.projectDir}`,
        ),
      );
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(failures, "Browser test and teardown failures");
    }
  },
});

export { expect } from "@playwright/test";
