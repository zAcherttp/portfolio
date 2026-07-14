import { expect, test } from "@playwright/test";

test.describe("component documentation", () => {
  test("opens every documented component from the component index", async ({
    page,
  }) => {
    await page.goto("/components");

    const componentLinks = page.locator('a[href^="/components/"]');
    const hrefs = await componentLinks.evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => href !== null),
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator("article h1")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
    }
  });

  test("returns not found for an unknown component", async ({ page }) => {
    const response = await page.goto("/components/not-a-component");

    expect(response?.status()).toBe(404);
  });

  test("offers source, share, and adjacent component actions", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {},
      });
    });
    await page.goto("/components/activity-grid");

    const copyPageButton = page.getByRole("button", { name: "Copy page" });
    await expect(copyPageButton).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Previous component: Floating Tooltip" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Next component: Contribution Graph",
      }),
    ).toBeVisible();

    const viewOptionsButton = page.getByRole("button", {
      name: "View options",
    });
    const copyButtonGroup = copyPageButton.locator("..");
    await expect(copyButtonGroup).toHaveCSS("border-radius", "10px");
    await expect(copyPageButton).toHaveCSS("border-radius", "8px 0px 0px 8px");
    await copyPageButton.hover();
    await expect(copyPageButton).not.toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    const activeButtonBackground = await copyPageButton.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await copyPageButton.click();
    await expect(copyPageButton).toHaveAccessibleName("Copy page");
    await expect(copyPageButton).toContainText("Copy page");
    await expect(viewOptionsButton).toHaveCSS("transition-duration", "0s");
    await viewOptionsButton.click();
    await expect(viewOptionsButton).toHaveCSS(
      "background-color",
      activeButtonBackground,
    );
    await expect(
      page.getByRole("menuitem", { name: "View as Markdown" }),
    ).toHaveAttribute("href", /\/components\/activity-grid\.mdx$/);
    await expect(
      page.getByRole("menuitem", { name: "Open in GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/zAcherttp/portfolio/blob/master/content/components/activity-grid.mdx",
    );

    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Share component documentation" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Copy link" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    await expect(
      page.getByRole("menuitem", { name: /Copy link|Link copied/ }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Other app" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Other app" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await page
      .getByRole("link", { name: "Next component: Contribution Graph" })
      .click();
    await expect(page).toHaveURL(/\/components\/contribution-graph$/);
  });

  test("serves component documentation as Markdown", async ({ request }) => {
    const response = await request.get("/components/activity-grid.mdx");
    const markdown = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/markdown");
    expect(markdown).toContain("# Activity Grid");
    expect(markdown).toContain("| Prop | Type | Description |");
    expect(markdown).not.toContain("<AutoTypeTable");
  });

  test("uses one surface color for code frames and type tables", async ({
    page,
  }) => {
    await page.goto("/components/activity-grid");

    const codeFrame = page.locator("[data-code-frame]").first();
    const typeTable = page.locator("table").first().locator("xpath=../..");
    const codeFrameBackground = await codeFrame.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );

    await expect(typeTable).toHaveCSS("background-color", codeFrameBackground);

    const exampleTabs = page.getByRole("tablist", {
      name: "Activity Grid example",
    });
    await exampleTabs.getByRole("tab", { name: "Code" }).click();
    const examplePanel = exampleTabs.locator("..").getByRole("tabpanel");
    await expect(examplePanel).toHaveCSS(
      "background-color",
      codeFrameBackground,
    );
  });

  test("offers shadcn registry commands for every package runner", async ({
    page,
  }) => {
    await page.goto("/components/activity-grid");

    const installTabs = page.getByRole("tablist", {
      name: "Activity Grid installation method",
    });
    const installPanel = installTabs.locator("..").getByRole("tabpanel");
    const packageManagers = installPanel.getByRole("group", {
      name: "Package manager",
    });
    const command = installPanel.locator("code");
    const registryItem = "@zacherttp/activity-grid";
    const commands = {
      pnpm: `pnpm dlx shadcn@latest add ${registryItem}`,
      npm: `npx shadcn@latest add ${registryItem}`,
      yarn: `yarn dlx shadcn@latest add ${registryItem}`,
      bun: `bunx --bun shadcn@latest add ${registryItem}`,
    } as const;

    for (const [manager, expectedCommand] of Object.entries(commands)) {
      await packageManagers.getByRole("button", { name: manager }).click();
      await expect(command).toHaveText(expectedCommand);
    }
  });

  test("rotates the shared arrow when a component link is hovered", async ({
    page,
  }) => {
    await page.goto("/components");

    const componentLink = page.locator('a[href^="/components/"]').first();
    const arrow = componentLink.locator("[data-rotating-arrow]");
    const restingRotation = await arrow.evaluate(
      (element) => getComputedStyle(element).rotate,
    );

    await expect(arrow).toHaveCSS("transition-duration", "0.14s");
    await expect(arrow).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.25, 0.1, 0.25, 1)",
    );

    await componentLink.hover();

    await expect
      .poll(() => arrow.evaluate((element) => getComputedStyle(element).rotate))
      .not.toBe(restingRotation);

    await arrow.hover();
    await expect(arrow).toHaveCSS("transition-duration", "0.14s");
  });

  test("removes rotating-arrow movement for reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/components");

    const componentLink = page.locator('a[href^="/components/"]').first();
    const arrow = componentLink.locator("[data-rotating-arrow]");

    await expect(arrow).toHaveCSS("transition-duration", "0s");
  });

  test("shows focused component API props without inherited DOM attributes", async ({
    page,
  }) => {
    for (const slug of ["activity-grid", "contribution-graph"]) {
      await page.goto(`/components/${slug}`);

      const apiHeading = page.getByRole("heading", { name: "API reference" });
      const apiTable = apiHeading.locator("xpath=following-sibling::div[1]");

      await expect(apiTable.getByRole("row")).toHaveCount(13);
      await expect(
        apiTable.getByRole("cell", { name: /^defaultChecked\??$/ }),
      ).toHaveCount(0);
      await expect(
        apiTable.getByRole("cell", { name: /^className\??$/ }),
      ).toBeVisible();
      await expect(
        apiTable
          .locator('.docs-highlighted-type span[style*="--shiki-light"]')
          .first(),
      ).toBeVisible();
    }
  });

  test("switches preview and installation tabs with the keyboard", async ({
    page,
  }) => {
    await page.goto("/components/floating-tooltip");

    const exampleTabs = page.getByRole("tablist", {
      name: "Floating Tooltip example",
    });
    const previewTab = exampleTabs.getByRole("tab", { name: "Preview" });
    await previewTab.focus();
    await page.keyboard.press("ArrowRight");

    await expect(
      exampleTabs.getByRole("tab", { name: "Code" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\/components\/floating-tooltip$/);

    const installTabs = page.getByRole("tablist", {
      name: "Floating Tooltip installation method",
    });
    await expect(
      installTabs.getByRole("tab", { name: "Command" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
