import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openBrowser, parseArgs } from "../src/cli.js";

// Light smoke: package metadata and bin entry exist for publishability.
describe("package metadata", () => {
  it("exposes bin, license, and engines", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.name).toBe("openspec-viewer");
    expect(pkg.license).toBe("MIT");
    expect(pkg.bin["openspec-viewer"]).toBe("./dist/cli.js");
    expect(pkg.engines.node).toMatch(/>=\s*20/);
    expect(pkg.files).toContain("dist");
  });

  it("prints the package version through the public CLI", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", join(process.cwd(), "src", "cli.ts"), "--version"],
      { encoding: "utf8" },
    );

    expect(output.trim()).toBe(pkg.version);
  });
});

describe("source CLI arguments", () => {
  it("parses positional and named project paths", () => {
    const cwd = "/fictional/workspace";

    expect(parseArgs(["../project"], cwd)).toMatchObject({
      path: resolve(cwd, "../project"),
      port: 4321,
      host: "127.0.0.1",
      archive: true,
      open: true,
    });
    expect(parseArgs(["--path", "./nested"], cwd).path).toBe(
      resolve(cwd, "nested"),
    );
  });

  it("parses server, archive, and browser options", () => {
    expect(
      parseArgs(
        [
          "--port",
          "5173",
          "--host",
          "127.0.0.2",
          "--no-archive",
          "--no-open",
        ],
        "/fictional/workspace",
      ),
    ).toMatchObject({
      port: 5173,
      host: "127.0.0.2",
      archive: false,
      open: false,
    });
    expect(parseArgs(["--no-archive", "--archive"]).archive).toBe(true);
    expect(parseArgs(["--port", "0"]).port).toBe(0);
  });

  it("parses demo mode and rejects an ambiguous project path", () => {
    expect(parseArgs(["--demo"])).toMatchObject({
      demo: true,
      path: process.cwd(),
    });
    expect(() => parseArgs(["--demo", "../project"])).toThrow(
      "--demo cannot be combined with a project path",
    );
    expect(() => parseArgs(["--demo", "--path", "../project"])).toThrow(
      "--demo cannot be combined with a project path",
    );
  });

  it("rejects unknown options and invalid ports", () => {
    expect(() => parseArgs(["--unknown"])).toThrow(
      "Unknown option: --unknown",
    );
    for (const port of ["", "   ", "not-a-port", "-1", "1.5", "65536"]) {
      expect(() => parseArgs(["--port", port]), port).toThrow(
        /^Invalid port:/,
      );
    }
  });

  it("builds platform browser commands through the injected launcher", () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const launch = (command: string, args: string[]) => {
      calls.push({ command, args });
    };
    const url = "http://127.0.0.1:4321";

    openBrowser(url, "darwin", launch);
    openBrowser(url, "linux", launch);
    openBrowser(url, "win32", launch);

    expect(calls).toEqual([
      { command: "open", args: [url] },
      { command: "xdg-open", args: [url] },
      { command: "cmd", args: ["/c", "start", "", url] },
    ]);
  });

  it("treats asynchronous browser-launch errors as optional", () => {
    const child = new EventEmitter() as EventEmitter & {
      unref: () => void;
    };
    let unreferenced = false;
    child.unref = () => {
      unreferenced = true;
    };

    openBrowser("http://127.0.0.1:4321", "linux", () => child);

    expect(() => child.emit("error", new Error("missing opener"))).not.toThrow();
    expect(unreferenced).toBe(true);
  });

  it("reports public help and invalid input through the source executable", () => {
    const cli = join(process.cwd(), "src", "cli.ts");
    const run = (args: string[]) =>
      spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
        encoding: "utf8",
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage:");
    expect(help.stdout).toContain("--demo");
    expect(help.stdout).toContain("--no-open");

    const unknown = run(["--unknown"]);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain("Unknown option: --unknown");

    const invalidPort = run(["--port", "65536"]);
    expect(invalidPort.status).toBe(1);
    expect(invalidPort.stderr).toContain("Invalid port: 65536");
  });
});
