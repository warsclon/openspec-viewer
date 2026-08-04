import { expect, test } from "@playwright/test";
import {
  CAPTURE_STEPS,
  runCaptureJourney,
  type CaptureStep,
} from "../helpers/capture-journey.js";
import { startTestServer } from "../helpers/server.js";

test("completes the shared media-capture journey on the demo fixture without machine content", async ({
  page,
}) => {
  const server = await startTestServer({ mode: "demo" });
  const captured: CaptureStep[] = [];
  try {
    await runCaptureJourney(page, server.url, {
      forbiddenText: [server.projectDir],
      onCapture: async (step, journeyPage) => {
        captured.push(step);
        await expect(
          journeyPage.locator("#demo-indicator"),
        ).toHaveText("Demo mode");
      },
    });
    expect(captured).toEqual([...CAPTURE_STEPS]);
  } finally {
    await server.close();
  }
});

test("fails fast when an expected journey control is missing", async ({
  page,
}) => {
  const server = await startTestServer();
  try {
    await expect(
      runCaptureJourney(page, server.url, { stepTimeoutMs: 1_500 }),
    ).rejects.toThrow(/failed at step "now"/);
  } finally {
    await server.close();
  }
});
