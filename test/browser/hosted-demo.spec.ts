import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStaticDemoServer } from "../helpers/static-demo.js";

test.beforeAll(() => {
  execFileSync("npm", ["run", "build:hosted-demo"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
});

test("serves the complete read-only workflow from a repository base path", async ({
  page,
}) => {
  const server = await startStaticDemoServer();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(`${server.url}#/next`);

    await expect(page.getByText("Read-only demo", { exact: true })).toBeVisible();
    await expect(page.locator("#project-path")).toHaveText(
      "Fictional demo project",
    );
    await expect(page.getByRole("heading", { name: "1 next task" })).toBeVisible();
    await expect(
      page.locator(".next-task input[type=checkbox]").first(),
    ).toBeDisabled();

    await page.goto(`${server.url}#/graph?spec=interface`);
    await expect(page).toHaveURL(
      /\/openspec-viewer\/#\/graph\?spec=interface$/,
    );
    await expect(
      page.getByRole("img", { name: "Specs and changes graph" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Focus: interface/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Search changes/ }).click();
    await page.getByRole("searchbox").fill("browser state");
    await expect(page.getByText("design · add-dark-mode")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(`${server.url}#/change/add-dark-mode/tasks`);
    await expect(
      page.getByRole("heading", { name: "add-dark-mode" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New" })).toBeHidden();
    await expect(page.locator("#btn-archive")).toBeHidden();
    await expect(page.locator(".task.editable")).toHaveCount(0);
    await expect(
      page.locator("#panel-tasks input[type=checkbox]").first(),
    ).toBeDisabled();
    await expect(page.locator('[data-act="add-section"]')).toHaveCount(0);
    await expect(page.locator(".add-task-input")).toHaveCount(0);

    await page.getByRole("button", { name: "Proposal", exact: true }).click();
    await expect(page.locator("#panel-proposal textarea")).toHaveCount(0);
    await expect(page.locator("#panel-proposal")).toContainText(
      "comfortable theme",
    );

    for (const tab of ["Design", "Notes"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      const panel = page.locator(`#panel-${tab.toLowerCase()}`);
      await expect(panel.locator("textarea")).toHaveCount(0);
      await expect(panel.locator("[data-save]")).toHaveCount(0);
    }

    for (const route of ["timeline", "board"]) {
      await page.goto(`${server.url}#/${route}`);
      await expect(page.getByText("legacy-search").first()).toBeVisible();
    }

    for (const tab of ["proposal", "design", "tasks", "diff", "specs", "notes"]) {
      await page.goto(`${server.url}#/change/add-dark-mode/${tab}`);
      await expect(
        page.getByRole("heading", { name: "add-dark-mode" }),
      ).toBeVisible();
      await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    }

    await page.goto(
      `${server.url}#/change/archive%2F2026-07-01-legacy-search/proposal`,
    );
    await expect(
      page.getByRole("heading", { name: "legacy-search" }),
    ).toBeVisible();
    await expect(page.locator("#detail-status")).toHaveText("archived");
    await expect(page.locator("#panel-proposal textarea")).toHaveCount(0);

    expect(
      server.requests.filter(({ pathname }) => pathname.startsWith("/api/")),
    ).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await page.close({ runBeforeUnload: false });
    await server.close();
  }
});
