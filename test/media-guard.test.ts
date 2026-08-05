import { homedir, tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  assertNoSensitiveTokens,
  findSensitiveTokens,
  machineTokens,
} from "../scripts/lib/media-guard.js";

describe("machineTokens", () => {
  it("includes the home and temp directories", () => {
    const tokens = machineTokens();
    expect(tokens).toContain(homedir());
    expect(tokens).toContain(tmpdir());
  });

  it("never yields a token short enough to match arbitrary bytes", () => {
    for (const token of machineTokens()) {
      expect(token.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("findSensitiveTokens", () => {
  it("reports nothing for clean bytes", () => {
    const bytes = Buffer.from("\x89PNG\r\n\x1a\nIHDR pixels only");
    expect(findSensitiveTokens(bytes, ["/Users/someone"])).toEqual([]);
  });

  it("finds a token stored as UTF-8", () => {
    const bytes = Buffer.concat([
      Buffer.from("tEXtSource\0"),
      Buffer.from("/Users/someone/project/hero.png"),
    ]);
    expect(findSensitiveTokens(bytes, ["/Users/someone"])).toEqual([
      "/Users/someone",
    ]);
  });

  it("finds a token stored as UTF-16LE", () => {
    const bytes = Buffer.from("/var/folders/ab/demo", "utf16le");
    expect(findSensitiveTokens(bytes, ["/var/folders/ab"])).toEqual([
      "/var/folders/ab",
    ]);
  });

  it("reports every matching token, not only the first", () => {
    const bytes = Buffer.from("XMP /Users/someone and /var/folders/ab end");
    expect(
      findSensitiveTokens(bytes, ["/Users/someone", "/var/folders/ab", "/nope"]),
    ).toEqual(["/Users/someone", "/var/folders/ab"]);
  });

  it("ignores empty tokens instead of matching everything", () => {
    expect(findSensitiveTokens(Buffer.from("anything"), [""])).toEqual([]);
  });

  it("scans a view that does not start at its buffer origin", () => {
    const backing = Buffer.from("padding/Users/someone");
    const view = new Uint8Array(backing.buffer, backing.byteOffset + 7, 14);
    expect(findSensitiveTokens(view, ["/Users/someone"])).toEqual([
      "/Users/someone",
    ]);
  });
});

describe("assertNoSensitiveTokens", () => {
  it("passes for bytes without machine content", () => {
    expect(() =>
      assertNoSensitiveTokens("hero.png", Buffer.from("GIF89a")),
    ).not.toThrow();
  });

  it("names the asset and the leaked token", () => {
    expect(() =>
      assertNoSensitiveTokens(
        "hero.png",
        Buffer.from(`comment ${homedir()} end`),
      ),
    ).toThrow(/hero\.png embeds machine content/);
  });

  it("honours extra tokens such as the temporary demo directory", () => {
    expect(() =>
      assertNoSensitiveTokens("workflow.gif", Buffer.from("run in /demo-42"), [
        "/demo-42",
      ]),
    ).toThrow(/\/demo-42/);
  });
});
