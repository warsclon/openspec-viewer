import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { startTestServer } from "../helpers/server.js";
import { expect, test } from "./fixtures.js";

function inputWithValue(page: Page, value: string) {
  return page.locator(`input[value=${JSON.stringify(value)}]`);
}

test("loads the project and navigates Now, Graph, Timeline, Board, detail, and archived state", async ({
  app,
}) => {
  const { page, url } = app;
  await page.goto(`${url}/#/next`);

  await expect(page.getByRole("heading", { name: "OpenSpec Viewer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 next task" })).toBeVisible();
  await expect(page.getByText("Add the theme selector")).toBeVisible();

  await page.locator('.next-card [data-open="add-dark-mode"]').click();
  await expect(page).toHaveURL(/#\/change\/add-dark-mode$/);
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await expect(page).toHaveURL(/#\/next$/);

  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(page).toHaveURL(/#\/graph$/);
  await expect(
    page.getByRole("img", { name: "Specs and changes graph" }),
  ).toBeVisible();

  await page.locator('.g-node[data-spec="interface"]').click();
  await expect(page).toHaveURL(/#\/graph\?spec=interface$/);
  await expect(page.getByRole("button", { name: /Focus: interface/ })).toBeVisible();

  await page.locator('.g-node[data-change="add-dark-mode"]').click();
  await expect(page).toHaveURL(/#\/change\/add-dark-mode$/);
  await expect(page.getByRole("heading", { name: "add-dark-mode" })).toBeVisible();

  for (const tab of ["Tasks", "Diff", "Specs"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      page.locator(`#panel-${tab.toLowerCase()}`),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await expect(page).toHaveURL(/#\/change\/add-dark-mode\/proposal$/);
  await expect(page.locator("#panel-proposal .editor-input")).toHaveValue(
    /comfortable theme/,
  );

  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page).toHaveURL(/#\/timeline$/);
  await expect(page.getByText("legacy-search").first()).toBeVisible();

  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page).toHaveURL(/#\/board$/);
  await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();

  await page.getByRole("button", { name: /legacy-search/ }).first().click();
  await expect(page).toHaveURL(
    /#\/change\/archive%2F2026-07-01-legacy-search(?:\/proposal)?$/,
  );
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.getByText("Archived · read-only")).toBeVisible();
  await expect(page.locator("#panel-tasks input[type=checkbox]").first()).toBeDisabled();
  await expect(page.locator("#panel-proposal [data-save]")).toHaveCount(0);
});

test("supports direct links, keyboard search, empty results, focus restoration, and history", async ({
  app,
}) => {
  const { page, url } = app;
  await page.goto(`${url}/#/change/add-dark-mode/design`);

  await expect(page.getByRole("heading", { name: "add-dark-mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Design", exact: true })).toHaveClass(
    /active/,
  );
  await expect(page.locator("#panel-design .editor-input")).toHaveValue(
    /local browser state/,
  );

  const searchButton = page.getByRole("button", {
    name: /Search changes, tasks, specs/,
  });
  await searchButton.focus();
  await page.keyboard.press("Enter");
  const searchInput = page.getByRole("searchbox");
  await expect(searchInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(searchInput).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(searchInput).toBeFocused();
  await searchInput.fill("no fictional result exists");
  await expect(page.locator(".search-empty")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchButton).toBeFocused();

  await page.keyboard.press("ControlOrMeta+K");
  await searchInput.fill("browser state");
  await expect(page.getByRole("button", { name: /design.*add-dark-mode/i })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/change\/add-dark-mode\/design$/);

  await page.evaluate(() => {
    location.hash = "#/board";
  });
  await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/change\/add-dark-mode\/design$/);
  await expect(page.locator("#panel-design")).toBeVisible();
});

test("persists task toggle, add, edit, move, delete, and section operations after reload", async ({
  app,
}) => {
  const { page, url, projectDir } = app;
  await page.goto(`${url}/#/change/add-dark-mode`);
  await expect(page.getByRole("heading", { name: "add-dark-mode" })).toBeVisible();

  const themeTask = page.locator('.task.editable[data-task-id="1.2"]');
  await themeTask.locator('[data-act="toggle"]').check();
  await expect(themeTask.locator('[data-act="toggle"]')).toBeChecked();

  const keyboardText = inputWithValue(page, "Verify keyboard access");
  await keyboardText.fill("Verify keyboard-only browser access");
  await page.keyboard.press("Tab");
  await expect(
    inputWithValue(page, "Verify keyboard-only browser access"),
  ).toBeVisible();

  const addTask = page.locator('.add-task-input[data-si="0"]');
  await addTask.fill("Verify browser persistence");
  await addTask.press("Enter");
  const addedText = inputWithValue(page, "Verify browser persistence");
  await expect(addedText).toBeVisible();
  const addedTask = addedText.locator(
    "xpath=ancestor::div[contains(@class, 'task editable')]",
  );
  await addedTask.locator('[data-act="up"]').click();
  const firstSectionTaskTexts = page.locator(
    '.section[data-si="0"] .task-text-input',
  );
  await expect
    .poll(() => firstSectionTaskTexts.evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    ))
    .toEqual([
      "Define the color tokens",
      "Verify browser persistence",
      "Add the theme selector",
    ]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "add-dark-mode" })).toBeVisible();
  await expect
    .poll(() => firstSectionTaskTexts.evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    ))
    .toEqual([
      "Define the color tokens",
      "Verify browser persistence",
      "Add the theme selector",
    ]);
  await expect(
    page.locator(
      '.task.editable[data-task-id="1.2"] input[type="checkbox"]',
    ),
  ).toBeChecked();
  await expect(
    inputWithValue(page, "Verify keyboard-only browser access"),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator('input[value="Verify browser persistence"]')
    .locator("xpath=ancestor::div[contains(@class, 'task editable')]")
    .locator('[data-act="delete"]')
    .click();
  await expect(inputWithValue(page, "Verify browser persistence")).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept("3. Browser checks"));
  const addSectionResponse = page.waitForResponse((response) => {
    if (
      !response.url().endsWith("/tasks/mutate") ||
      response.request().method() !== "POST"
    ) {
      return false;
    }
    return response.request().postDataJSON()?.type === "add-section";
  });
  await page.getByRole("button", { name: "+ Section" }).click();
  const sectionResult = await addSectionResponse;
  expect(sectionResult.status()).toBe(200);
  expect(await sectionResult.json()).toMatchObject({
    sections: expect.arrayContaining([
      expect.objectContaining({ title: "3. Browser checks" }),
    ]),
  });
  const sectionTitle = inputWithValue(page, "3. Browser checks");
  await expect(sectionTitle).toBeVisible();
  const tasksWithEmptySection = readFileSync(
    join(projectDir, "openspec", "changes", "add-dark-mode", "tasks.md"),
    "utf8",
  );
  expect(tasksWithEmptySection).toMatch(/## 3\. Browser checks\n$/);
  await sectionTitle.fill("3. Browser verification");
  await page.keyboard.press("Tab");
  await expect(inputWithValue(page, "3. Browser verification")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator('input[value="3. Browser verification"]')
    .locator("xpath=ancestor::div[contains(@class, 'section')]")
    .locator('[data-act="delete-section"]')
    .click();
  await expect(inputWithValue(page, "3. Browser verification")).toHaveCount(0);

  const idInput = inputWithValue(page, "2.1");
  await idInput.fill("");
  await page.keyboard.press("Tab");
  await expect(page.locator("#toast")).toContainText("ID cannot be empty");

  await page.reload();
  await expect(
    page.locator(
      '.task.editable[data-task-id="1.2"] input[type="checkbox"]',
    ),
  ).toBeChecked();
  await expect(
    inputWithValue(page, "Verify keyboard-only browser access"),
  ).toBeVisible();

  const persisted = readFileSync(
    join(projectDir, "openspec", "changes", "add-dark-mode", "tasks.md"),
    "utf8",
  );
  expect(persisted).toContain("- [x] 1.2 Add the theme selector");
  expect(persisted).toContain("- [ ] 2.1 Verify keyboard-only browser access");
  expect(persisted).not.toContain("Verify browser persistence");
  expect(persisted).not.toContain("Browser verification");
});

test("preserves unsaved text and replays external SSE updates after save or revert", async ({
  app,
}) => {
  const { page, url } = app;
  await page.goto(`${url}/#/change/add-dark-mode/proposal`);
  await expect(page.locator("#live-label")).toHaveText("live");

  const proposal = page.locator("#panel-proposal .editor-input");
  const localDraft = "# Why\n\nUnsaved local proposal draft.\n";
  const externalDesign = "# Context\n\nDesign updated by another local client.\n";
  await proposal.fill(localDraft);

  const externalResponse = await fetch(
    `${url}/api/changes/add-dark-mode/design`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: externalDesign }),
    },
  );
  expect(externalResponse.status).toBe(200);
  await expect(page.locator("#live-label")).toHaveText("changes pending");
  await expect(proposal).toHaveValue(localDraft);

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/proposal") &&
      response.request().method() === "PUT",
  );
  await page.locator("#panel-proposal [data-save]").click();
  expect((await saveResponse).status()).toBe(200);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.locator("#panel-design .editor-input")).toHaveValue(
    externalDesign,
  );

  const revertedExternalDesign =
    "# Context\n\nSecond update from another local client.\n";
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await proposal.fill("# Why\n\nA second unsaved local draft.\n");
  const revertedExternalResponse = await fetch(
    `${url}/api/changes/add-dark-mode/design`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: revertedExternalDesign }),
    },
  );
  expect(revertedExternalResponse.status).toBe(200);
  await expect(page.locator("#live-label")).toHaveText("changes pending");

  await proposal.fill(localDraft);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.locator("#panel-design .editor-input")).toHaveValue(
    revertedExternalDesign,
  );
});

test("persists proposal, design, and local notes while archived artifacts remain read-only", async ({
  app,
}) => {
  const { page, url, projectDir } = app;
  await page.goto(`${url}/#/change/add-dark-mode/proposal`);

  const proposal = "# Why\n\nBrowser-edited proposal content.\n";
  const design = "# Context\n\nBrowser-edited design content.\n";
  const notes = "Browser-only local verification note.\n";

  await page.locator("#panel-proposal .editor-input").fill(proposal);
  const proposalResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/proposal") &&
      response.request().method() === "PUT",
  );
  await page.locator("#panel-proposal [data-save]").click();
  const savedProposal = await proposalResponse;
  expect(savedProposal.status()).toBe(200);
  expect(savedProposal.request().postDataJSON()).toEqual({ content: proposal });
  await expect(page.locator("#toast")).toContainText("proposal.md saved");
  expect(
    readFileSync(
      join(projectDir, "openspec", "changes", "add-dark-mode", "proposal.md"),
      "utf8",
    ),
  ).toBe(proposal);

  await page.getByRole("button", { name: "Design", exact: true }).click();
  const designEditor = page.locator("#panel-design .editor-input");
  await expect(designEditor).toHaveValue(/local browser state/);
  await designEditor.fill(design);
  const designResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/design") &&
      response.request().method() === "PUT",
  );
  await page.locator("#panel-design [data-save]").click();
  const savedDesign = await designResponse;
  expect(savedDesign.status()).toBe(200);
  expect(savedDesign.request().postDataJSON()).toEqual({ content: design });
  await expect(page.locator("#toast")).toContainText("design.md saved");
  expect(
    readFileSync(
      join(projectDir, "openspec", "changes", "add-dark-mode", "design.md"),
      "utf8",
    ),
  ).toBe(design);

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const notesEditor = page.locator("#panel-notes .editor-input");
  await expect(notesEditor).toHaveValue("");
  await notesEditor.fill(notes);
  const notesResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/notes") &&
      response.request().method() === "PUT",
  );
  await page.locator("#panel-notes [data-save]").click();
  const savedNotes = await notesResponse;
  expect(savedNotes.status()).toBe(200);
  expect(savedNotes.request().postDataJSON()).toEqual({ content: notes });
  await expect(page.locator("#toast")).toContainText("Notes saved locally");
  expect(
    readFileSync(
      join(projectDir, ".openspec-viewer", "notes", "add-dark-mode.md"),
      "utf8",
    ),
  ).toBe(notes);

  await page.reload();
  await expect(page.locator("#panel-notes .editor-input")).toHaveValue(notes);
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await expect(page.locator("#panel-proposal .editor-input")).toHaveValue(proposal);
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await expect(page.locator("#panel-design .editor-input")).toHaveValue(design);

  expect(
    readFileSync(
      join(projectDir, "openspec", "changes", "add-dark-mode", "proposal.md"),
      "utf8",
    ),
  ).toBe(proposal);
  expect(
    readFileSync(
      join(projectDir, "openspec", "changes", "add-dark-mode", "design.md"),
      "utf8",
    ),
  ).toBe(design);
  expect(
    readFileSync(
      join(projectDir, ".openspec-viewer", "notes", "add-dark-mode.md"),
      "utf8",
    ),
  ).toBe(notes);

  await page.goto(
    `${url}/#/change/archive%2F2026-07-01-legacy-search/proposal`,
  );
  await expect(page.locator("#detail-status")).toHaveText("archived");
  await expect(page.locator("#panel-proposal .editor-input")).toHaveCount(0);
  await expect(page.locator("#panel-proposal [data-save]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive…", exact: true })).toBeHidden();
});

test("keeps primary keyboard controls named, visibly focused, and restores dialog focus", async ({
  app,
}) => {
  const { page, url } = app;
  await page.goto(`${url}/#/next`);

  for (const name of ["Now", "Graph", "Timeline", "Board", "Detail"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Decrease font size" }),
  ).toBeVisible();

  const graphButton = page.getByRole("button", { name: "Graph", exact: true });
  await graphButton.focus();
  await expect(graphButton).toBeFocused();
  const outline = await graphButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).not.toBe("0px");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/graph$/);

  const specNode = page.getByRole("button", {
    name: "Focus spec interface",
  });
  await specNode.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/graph\?spec=interface$/);

  const changeNode = page.getByRole("button", {
    name: "Open change add-dark-mode",
  });
  await changeNode.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/change\/add-dark-mode$/);

  const newChange = page.getByRole("button", { name: "+ New" });
  await newChange.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog").filter({ hasText: "New change" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Name (kebab-case)")).toBeFocused();
  expect(
    await page.locator(".app").evaluate((element) => (element as HTMLElement).inert),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Name (kebab-case)")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(
    await page.locator(".app").evaluate((element) => (element as HTMLElement).inert),
  ).toBe(false);
  await expect(newChange).toBeFocused();

  await page.keyboard.press("Enter");
  await page.getByLabel("Name (kebab-case)").fill("browser-created-change");
  await page
    .getByLabel("Description (optional)")
    .fill("Created through the keyboard-only browser journey");
  const createButton = page.getByRole("button", { name: "Create", exact: true });
  await createButton.focus();
  await expect(createButton).toBeFocused();
  await createButton.press("Enter");
  await expect(page.locator("#toast")).toHaveText(
    "Change browser-created-change created",
  );
  await expect(
    page.getByRole("heading", { name: "browser-created-change" }),
  ).toBeVisible();
});

test("identifies demo content without exposing its temporary machine path", async ({
  page,
}) => {
  const server = await startTestServer({ mode: "demo" });
  try {
    await page.goto(`${server.url}/#/next`);

    await expect(page.getByText("Demo mode", { exact: true })).toBeVisible();
    await expect(page.locator("#project-path")).toHaveText(
      "Fictional demo project",
    );
    await expect(page.locator("body")).not.toContainText(server.projectDir);
  } finally {
    await server.close();
  }
});
