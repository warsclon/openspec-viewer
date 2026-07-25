import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestProject } from "../helpers/fixture.js";

describe("test project fixture", () => {
  it("creates independent copies and removes each temporary project", () => {
    const first = createTestProject();
    const second = createTestProject();

    try {
      expect(first.projectDir).not.toBe(second.projectDir);
      const marker = join(first.projectDir, "temporary-marker.txt");
      writeFileSync(marker, "first project only\n", "utf8");
      expect(existsSync(marker)).toBe(true);
      expect(existsSync(join(second.projectDir, "temporary-marker.txt"))).toBe(false);
    } finally {
      first.cleanup();
      second.cleanup();
    }

    expect(existsSync(first.projectDir)).toBe(false);
    expect(existsSync(second.projectDir)).toBe(false);
  });
});
