import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
