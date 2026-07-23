import { describe, expect, it } from "vitest";
import { parseDeltaOperations } from "../src/openspec/spec-diff.js";

describe("parseDeltaOperations", () => {
  it("extracts ADDED/MODIFIED/REMOVED requirements", () => {
    const md = `## ADDED Requirements

### Requirement: Theme selection
The app SHALL support dark mode.

#### Scenario: toggle
- **WHEN** user clicks
- **THEN** theme changes

## MODIFIED Requirements

### Requirement: Settings page
Settings MUST include theme.

## REMOVED Requirements

### Requirement: Legacy flag
Old flag is gone.
`;
    const ops = parseDeltaOperations(md);
    expect(ops).toHaveLength(3);
    expect(ops[0]).toMatchObject({ op: "ADDED", title: "Theme selection" });
    expect(ops[1].op).toBe("MODIFIED");
    expect(ops[2].op).toBe("REMOVED");
    expect(ops[0].preview).toContain("SHALL support dark mode");
  });
});
