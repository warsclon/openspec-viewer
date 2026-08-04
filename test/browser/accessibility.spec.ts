import { expect, test } from "@playwright/test";
import { startTestServer, type TestServer } from "../helpers/server.js";

test.describe("launch accessibility in demo mode", () => {
  let server: TestServer;

  test.beforeEach(async () => {
    server = await startTestServer({ mode: "demo" });
  });

  test.afterEach(async () => {
    await server.close();
  });

  test("announces demo labeling and names the primary visuals", async ({
    page,
  }) => {
    await page.goto(`${server.url}/#/next`);

    const indicator = page.locator("#demo-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText("Demo mode");
    await expect(indicator).toHaveAttribute("role", "status");
    await expect(page.locator("#project-path")).toHaveText(
      "Fictional demo project",
    );

    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await expect(
      page.getByRole("img", { name: "Specs and changes graph" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Focus spec interface" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open change add-dark-mode" }),
    ).toBeVisible();
  });

  test("supports the keyboard-only demo journey with visible focus", async ({
    page,
  }) => {
    await page.goto(`${server.url}/#/next`);
    await expect(page.locator("#demo-indicator")).toBeVisible();

    const graphButton = page.getByRole("button", {
      name: "Graph",
      exact: true,
    });
    await graphButton.focus();
    const outline = await graphButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).not.toBe("0px");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/graph$/);

    const specNode = page.getByRole("button", { name: "Focus spec interface" });
    await specNode.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/graph\?spec=interface$/);

    const changeNode = page.getByRole("button", {
      name: "Open change add-dark-mode",
    });
    await changeNode.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/change\/add-dark-mode$/);

    const searchButton = page.getByRole("button", {
      name: /Search changes, tasks, specs/,
    });
    await searchButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("searchbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(searchButton).toBeFocused();
  });

  test("disables animation and transitions when reduced motion is requested", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${server.url}/#/next`);
    await expect(page.locator("#demo-indicator")).toBeVisible();

    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    const durations = await page.evaluate(() => {
      const seconds = (value: string) =>
        Math.max(
          ...value.split(",").map((part) => Math.abs(parseFloat(part)) || 0),
        );
      const body = getComputedStyle(document.body);
      const panel = getComputedStyle(
        document.querySelector(".panel") ?? document.body,
      );
      return {
        bodyTransition: seconds(body.transitionDuration),
        panelAnimation: seconds(panel.animationDuration),
      };
    });
    expect(durations.bodyTransition).toBeLessThan(0.001);
    expect(durations.panelAnimation).toBeLessThan(0.001);
  });
});
