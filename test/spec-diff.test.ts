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

  it("classifies renamed and unknown requirement sections", () => {
    const ops = parseDeltaOperations(`### Requirement: Unscoped behavior
This requirement appears before an operation header.

## RENAMED Requirements

### Requirement: New behavior name
The behavior keeps its existing semantics.
`);

    expect(ops).toEqual([
      {
        op: "UNKNOWN",
        title: "Unscoped behavior",
        preview: "This requirement appears before an operation header.",
      },
      {
        op: "RENAMED",
        title: "New behavior name",
        preview: "The behavior keeps its existing semantics.",
      },
    ]);
  });

  it("parses multiple requirements without requiring scenarios", () => {
    const ops = parseDeltaOperations(`## ADDED Requirements

### Requirement: First
First preview.

### Requirement: Second
Second preview.
`);

    expect(ops.map((operation) => operation.title)).toEqual(["First", "Second"]);
    expect(ops.every((operation) => operation.op === "ADDED")).toBe(true);
  });

  it("bounds previews and excludes nested headings", () => {
    const longText = "x".repeat(320);
    const [operation] = parseDeltaOperations(`## MODIFIED Requirements

### Requirement: Bounded preview
${longText}

#### Scenario: Hidden heading
- **WHEN** an event occurs
- **THEN** a result appears
`);

    expect(operation.preview).toHaveLength(280);
    expect(operation.preview).not.toContain("Scenario:");
  });
});
