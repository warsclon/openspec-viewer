import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers/server.js";

const servers: TestServer[] = [];

afterEach(async () => {
  await Promise.allSettled(servers.splice(0).map((server) => server.close()));
});

describe("server lifecycle", () => {
  it("reports an ephemeral URL and cleans up idempotently", async () => {
    const server = await startTestServer();
    servers.push(server);

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.url).not.toMatch(/:0$/);
    expect(existsSync(server.projectDir)).toBe(true);

    const response = await fetch(`${server.url}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, watchers: 0 });

    await server.close();
    expect(existsSync(server.projectDir)).toBe(false);
    await expect(server.close()).resolves.toBeUndefined();
  });

  it("isolates concurrent servers and temporary projects", async () => {
    const [first, second] = await Promise.all([startTestServer(), startTestServer()]);
    servers.push(first, second);

    expect(first.url).not.toBe(second.url);
    expect(first.projectDir).not.toBe(second.projectDir);

    const [firstHealth, secondHealth] = await Promise.all([
      fetch(`${first.url}/api/health`),
      fetch(`${second.url}/api/health`),
    ]);
    await expect(firstHealth.json()).resolves.toEqual({ ok: true, watchers: 0 });
    await expect(secondHealth.json()).resolves.toEqual({ ok: true, watchers: 0 });

    const changedProposal = "## Why\n\nOnly the first test project changes.\n";
    const [noteWrite, proposalWrite] = await Promise.all([
      fetch(`${first.url}/api/changes/add-dark-mode/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "First server only.\n" }),
      }),
      fetch(`${first.url}/api/changes/add-dark-mode/proposal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: changedProposal }),
      }),
    ]);
    expect(noteWrite.status).toBe(200);
    expect(proposalWrite.status).toBe(200);

    const [firstDetail, secondDetail] = await Promise.all([
      fetch(`${first.url}/api/changes/add-dark-mode`).then((response) => response.json()),
      fetch(`${second.url}/api/changes/add-dark-mode`).then((response) => response.json()),
    ]);
    expect(firstDetail).toMatchObject({
      notes: "First server only.\n",
      proposal: changedProposal,
    });
    expect(secondDetail).toMatchObject({
      notes: "",
      proposal: expect.stringContaining("Readers need a comfortable theme"),
    });
  });
});
