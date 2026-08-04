import { homedir, tmpdir } from "node:os";
import type { Page } from "@playwright/test";

export const CAPTURE_VIEWPORT = { width: 1280, height: 800 } as const;
export const SOCIAL_PREVIEW_VIEWPORT = { width: 1280, height: 640 } as const;

export type CaptureStep = "now" | "graph" | "tasks";

export const CAPTURE_STEPS: readonly CaptureStep[] = ["now", "graph", "tasks"];

export type CaptureJourneyOptions = {
  /** Extra strings that must never appear in the rendered page. */
  forbiddenText?: string[];
  /** Called after each step renders its stable capture state. */
  onCapture?: (step: CaptureStep, page: Page) => Promise<void>;
  /** Pause after each step so recordings stay watchable. */
  pauseMs?: number;
  /** Fail-fast budget for every expected control in a step. */
  stepTimeoutMs?: number;
};

function journeyError(step: CaptureStep, cause: unknown): Error {
  const message =
    cause instanceof Error ? cause.message : String(cause ?? "unknown");
  return new Error(
    `Launch capture journey failed at step "${step}": ${message}. ` +
      "The demo fixture or an expected control could not be loaded.",
  );
}

async function assertNoMachineContent(
  page: Page,
  forbiddenText: string[],
): Promise<void> {
  const forbidden = [homedir(), tmpdir(), ...forbiddenText].filter(Boolean);
  const bodyText = await page.evaluate(() => document.body.innerText);
  for (const text of forbidden) {
    if (bodyText.includes(text)) {
      throw new Error(`Rendered page exposes machine content: ${text}`);
    }
  }
}

/**
 * The deterministic Now → Graph → task-interaction journey shared by browser
 * tests and the launch media capture script. Every step waits for a stable,
 * fixture-backed state and fails fast when an expected control is missing.
 */
export async function runCaptureJourney(
  page: Page,
  baseUrl: string,
  options: CaptureJourneyOptions = {},
): Promise<void> {
  const {
    forbiddenText = [],
    onCapture,
    pauseMs = 0,
    stepTimeoutMs = 10_000,
  } = options;
  page.setDefaultTimeout(stepTimeoutMs);

  const capture = async (step: CaptureStep) => {
    await assertNoMachineContent(page, forbiddenText);
    await onCapture?.(step, page);
    if (pauseMs > 0) await page.waitForTimeout(pauseMs);
  };

  let step: CaptureStep = "now";
  try {
    await page.goto(`${baseUrl}/#/next`);
    await page.locator("#demo-indicator").waitFor({ state: "visible" });
    await page
      .getByRole("heading", { name: "1 next task" })
      .waitFor({ state: "visible" });
    await page
      .getByText("Add the theme selector")
      .first()
      .waitFor({ state: "visible" });
    await capture("now");

    step = "graph";
    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await page
      .getByRole("img", { name: "Specs and changes graph" })
      .waitFor({ state: "visible" });
    await page.locator('.g-node[data-spec="interface"]').click();
    await page
      .getByRole("button", { name: /Focus: interface/ })
      .waitFor({ state: "visible" });
    await capture("graph");

    step = "tasks";
    await page.locator('.g-node[data-change="add-dark-mode"]').click();
    await page
      .getByRole("heading", { name: "add-dark-mode" })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.locator("#panel-tasks").waitFor({ state: "visible" });
    const toggle = page.locator(
      '.task.editable[data-task-id="1.2"] [data-act="toggle"]',
    );
    await toggle.waitFor({ state: "visible" });
    await toggle.check();
    await capture("tasks");
  } catch (error) {
    throw journeyError(step, error);
  }
}
