import { expect, test } from "vitest";

test("deliberately fails to verify required-check enforcement", () => {
  expect("blocked by the main ruleset").toBe("mergeable");
});
