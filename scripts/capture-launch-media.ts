/**
 * Launch media capture: drives the deterministic demo fixture through the
 * shared Now → Graph → task-interaction journey, then optimizes and composes
 * the committed launch assets. Development-only; run with:
 *
 *   npm run capture:media   (requires ffmpeg on PATH)
 *
 * Outputs (docs/media/):
 *   hero.png            — primary README screenshot (Now view, 1280x800, dark)
 *   workflow.gif        — Now → Graph → task recording, rendered by GitHub
 *   social-preview.png  — composed 1280x640 social card
 *   journey-*.png, social-frame.png, workflow.webm — intermediates
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
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
import { assertNoSensitiveTokens } from "./lib/media-guard.js";

const MEDIA_DIR = join(process.cwd(), "docs", "media");

/** Assets that are committed, and therefore byte-scanned before we finish. */
const COMMITTED_ASSETS = ["hero.png", "workflow.gif", "social-preview.png"];

/**
 * The animation is a supporting visual, so it is encoded for weight rather
 * than fidelity: 800px is GitHub's rendered README width, and a UI recording
 * with flat fills quantizes cleanly without dithering.
 */
const GIF_WIDTH = 800;
const GIF_FPS = 10;
const GIF_COLORS = 128;

const CONTEXT_OPTIONS = {
  colorScheme: "dark",
  locale: "en-US",
  timezoneId: "UTC",
  reducedMotion: "reduce",
  serviceWorkers: "block",
} as const;

/** Temporary demo directories used this run, guarded against in the output. */
const demoDirs: string[] = [];

function ffmpeg(description: string, args: string[]): void {
  const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], {
    encoding: "utf8",
  });
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new Error(
      `${description} needs ffmpeg on PATH (macOS: brew install ffmpeg).`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${description} failed: ${result.stderr?.trim()}`);
  }
}

/**
 * Requantizes a screenshot to a 256-colour palette and drops every metadata
 * chunk. A flat dark UI loses no visible detail (measured SSIM 0.9996) while
 * the file gets roughly 60% smaller, and dithering is skipped because its
 * noise costs more bytes than the accuracy it buys here.
 */
function optimizeScreenshot(name: string): void {
  const target = join(MEDIA_DIR, name);
  const staging = join(MEDIA_DIR, `optimizing-${name}`);
  try {
    ffmpeg(`Optimizing ${name}`, [
      "-i",
      target,
      "-map_metadata",
      "-1",
      "-filter_complex",
      "[0:v]palettegen=max_colors=256:stats_mode=full[p];[0:v][p]paletteuse=dither=none",
      "-compression_level",
      "100",
      staging,
    ]);
    renameSync(staging, target);
  } catch (error) {
    rmSync(staging, { force: true });
    throw error;
  }
}

/**
 * GitHub renders an animated GIF inline from a plain Markdown image, which a
 * `.webm` never does, so the recording is transcoded for the README.
 */
function encodeWorkflowGif(): void {
  ffmpeg("Encoding workflow.gif", [
    "-i",
    join(MEDIA_DIR, "workflow.webm"),
    "-map_metadata",
    "-1",
    "-filter_complex",
    `[0:v]fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=${GIF_COLORS}:stats_mode=diff[p];` +
      "[b][p]paletteuse=dither=none:diff_mode=rectangle",
    "-loop",
    "0",
    join(MEDIA_DIR, "workflow.gif"),
  ]);
}

function socialPreviewMarkup(frameDataUri: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    position: relative;
    width: ${SOCIAL_PREVIEW_VIEWPORT.width}px;
    height: ${SOCIAL_PREVIEW_VIEWPORT.height}px;
    overflow: hidden;
    background: radial-gradient(130% 130% at 0% 0%, #17242f 0%, #0b0f14 62%);
    color: #e8eef4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  /* The card is read at thumbnail size, so the copy owns the left half and
     the product shot bleeds off the corner instead of floating inside it. */
  .copy {
    position: absolute; left: 72px; top: 50%; transform: translateY(-50%);
    width: 520px;
  }
  .mark {
    display: inline-block; padding: 8px 18px; margin-bottom: 26px;
    border: 1px solid #2ecc9b55; border-radius: 999px;
    color: #2ecc9b; font-size: 19px; font-weight: 600; letter-spacing: 0.1em;
  }
  h1 { font-size: 68px; line-height: 1.04; letter-spacing: -0.025em; }
  p { margin-top: 24px; font-size: 27px; line-height: 1.4; color: #9fb0bf; }
  .shot {
    position: absolute; left: 600px; top: 118px; width: 1120px;
    border-radius: 16px 0 0 0;
    border: 1px solid #ffffff1f; border-right: 0; border-bottom: 0;
    box-shadow: -30px -20px 90px #00000090;
  }
</style></head><body>
  <div class="copy">
    <span class="mark">OPENSPEC</span>
    <h1>OpenSpec<br>Viewer</h1>
    <p>A browser workspace for your specs, changes, and tasks.</p>
  </div>
  <img class="shot" src="${frameDataUri}" alt="">
</body></html>`;
}

/**
 * Composes the social card in the same browser that took the screenshot, so
 * the card is real product output with a title rather than a mockup.
 */
async function composeSocialPreview(browser: Browser): Promise<void> {
  const frame = readFileSync(join(MEDIA_DIR, "social-frame.png"));
  const context = await browser.newContext({
    ...CONTEXT_OPTIONS,
    viewport: { ...SOCIAL_PREVIEW_VIEWPORT },
  });
  try {
    const page = await context.newPage();
    await page.setContent(
      socialPreviewMarkup(`data:image/png;base64,${frame.toString("base64")}`),
      { waitUntil: "load" },
    );
    await page.screenshot({ path: join(MEDIA_DIR, "social-preview.png") });
  } finally {
    await context.close();
  }
  optimizeScreenshot("social-preview.png");
}

/**
 * Last line of defence before an asset is committed. The capture journey
 * already refuses to screenshot a page showing machine paths; this catches
 * paths an encoder may have written into the file's metadata instead.
 */
function guardCommittedAssets(): void {
  for (const name of COMMITTED_ASSETS) {
    assertNoSensitiveTokens(name, readFileSync(join(MEDIA_DIR, name)), demoDirs);
  }
}

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

async function captureSocialFrame(
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
        path: join(MEDIA_DIR, "social-frame.png"),
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
  demoDirs.push(demo.projectDir);
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
    await withDemoServer((url, dir) => captureSocialFrame(browser, url, dir));
    optimizeScreenshot("hero.png");
    encodeWorkflowGif();
    await composeSocialPreview(browser);
  } finally {
    await browser.close();
  }
  guardCommittedAssets();
  console.log(`Launch media written to ${MEDIA_DIR}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
