/**
 * Launch media capture: drives the deterministic demo fixture through the
 * shared Now → Graph → task-interaction journey and writes the raw launch
 * assets. Development-only; run with: npm run capture:media
 *
 * Outputs (docs/media/):
 *   journey-now.png, journey-graph.png, journey-tasks.png  — per-step frames
 *   hero.png            — primary README screenshot (Now view, 1280x800, dark)
 *   social-preview.png  — raw social frame (Graph view, 1280x640, dark)
 *   workflow.webm       — Now → Graph → task recording
 */
import { copyFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { createTemporaryDemoProject } from "../src/demo.js";
import { findOpenspecRoot } from "../src/openspec/discover.js";
import { startServer } from "../src/server.js";
import {
  CAPTURE_VIEWPORT,
  SOCIAL_PREVIEW_VIEWPORT,
  runCaptureJourney,
} from "../test/helpers/capture-journey.js";

const MEDIA_DIR = join(process.cwd(), "docs", "media");

const CONTEXT_OPTIONS = {
  colorScheme: "dark",
  locale: "en-US",
  timezoneId: "UTC",
  reducedMotion: "reduce",
  serviceWorkers: "block",
} as const;

async function captureJourneyMedia(
  browser: Browser,
  url: string,
  projectDir: string,
): Promise<void> {
  const context = await browser.newContext({
    ...CONTEXT_OPTIONS,
    viewport: { ...CAPTURE_VIEWPORT },
    recordVideo: { dir: MEDIA_DIR, size: { ...CAPTURE_VIEWPORT } },
  });
  const page = await context.newPage();

  await runCaptureJourney(page, url, {
    forbiddenText: [projectDir],
    pauseMs: 900,
    onCapture: async (step, journeyPage) => {
      await journeyPage.screenshot({
        path: join(MEDIA_DIR, `journey-${step}.png`),
      });
    },
  });

  const video = page.video();
  await context.close();
  if (!video) throw new Error("Recording was not produced");
  renameSync(await video.path(), join(MEDIA_DIR, "workflow.webm"));
  copyFileSync(
    join(MEDIA_DIR, "journey-now.png"),
    join(MEDIA_DIR, "hero.png"),
  );
}

async function captureSocialPreviewFrame(
  browser: Browser,
  url: string,
  projectDir: string,
): Promise<void> {
  const context = await browser.newContext({
    ...CONTEXT_OPTIONS,
    viewport: { ...SOCIAL_PREVIEW_VIEWPORT },
  });
  const page = await context.newPage();
  await runCaptureJourney(page, url, {
    forbiddenText: [projectDir],
    onCapture: async (step, journeyPage) => {
      if (step !== "graph") return;
      await journeyPage.screenshot({
        path: join(MEDIA_DIR, "social-preview.png"),
      });
    },
  });
  await context.close();
}

async function withDemoServer(
  capture: (url: string, projectDir: string) => Promise<void>,
): Promise<void> {
  // Each capture gets an isolated fixture copy: the journey mutates a task,
  // so reusing one project would change the Now view between captures.
  const demo = createTemporaryDemoProject("openspec-viewer-capture-");
  try {
    const server = await startServer({
      root: findOpenspecRoot(demo.projectDir),
      mode: "demo",
      host: "127.0.0.1",
      port: 0,
    });
    try {
      await capture(server.url, demo.projectDir);
    } finally {
      await server.close();
    }
  } finally {
    demo.cleanup();
  }
}

async function main(): Promise<void> {
  mkdirSync(MEDIA_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    await withDemoServer((url, dir) => captureJourneyMedia(browser, url, dir));
    await withDemoServer((url, dir) =>
      captureSocialPreviewFrame(browser, url, dir),
    );
    console.log(`Launch media written to ${MEDIA_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
