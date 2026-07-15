import { expect, test } from "@playwright/test";
import { componentRegistry } from "@/data/components";

test.describe("component documentation", () => {
  test("lists every documented component on the component index", async ({
    page,
  }) => {
    await page.goto("/components");

    for (const component of componentRegistry) {
      await expect(
        page.locator(`a[href="/components/${component.slug}"]`),
      ).toHaveCount(1);
    }
  });

  for (const component of componentRegistry) {
    test(`opens the ${component.name} documentation`, async ({ page }) => {
      await page.goto(`/components/${component.slug}`);
      await expect(
        page.getByRole("heading", { level: 1, name: component.name }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Usage" })).toBeVisible();
    });
  }

  test("returns not found for an unknown component", async ({ page }) => {
    const response = await page.goto("/components/not-a-component");

    expect(response?.status()).toBe(404);
  });

  test("offers source actions and preserves their active surface", async ({
    page,
  }) => {
    const supportsHover = await page.evaluate(
      () => window.matchMedia("(hover: hover)").matches,
    );
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
    await viewOptionsButton.click();
    const viewAsMarkdown = page.getByRole("menuitem", {
      name: "View as Markdown",
    });
    await expect(viewAsMarkdown).toBeVisible();
    const activeButtonBackground = await viewOptionsButton.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await page.keyboard.press("Escape");

    if (supportsHover) {
      await copyPageButton.hover();
      await expect(copyPageButton).toHaveCSS(
        "background-color",
        activeButtonBackground,
      );
    }
    await copyPageButton.click();
    await expect(copyPageButton).toHaveAccessibleName("Copy page");
    await expect(copyPageButton).toContainText("Copy page");
    await viewOptionsButton.click();
    await expect(viewOptionsButton).toHaveCSS(
      "background-color",
      activeButtonBackground,
    );
    await expect(viewAsMarkdown).toHaveAttribute(
      "href",
      /\/components\/activity-grid\.mdx$/,
    );
    await expect(
      page.getByRole("menuitem", { name: "Open in GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/zAcherttp/portfolio/blob/master/content/components/activity-grid.mdx",
    );
  });

  test("shares component documentation through copy and native actions", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {},
      });
    });
    await page.goto("/components/activity-grid");

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
  });

  test("navigates to the adjacent component", async ({ page }) => {
    await page.goto("/components/activity-grid");

    const nextComponent = page.getByRole("link", {
      name: "Next component: Contribution Graph",
    });
    await Promise.all([
      page.waitForURL(/\/components\/contribution-graph$/, {
        timeout: 15_000,
      }),
      nextComponent.click(),
    ]);
  });

  test("serves component documentation as Markdown", async ({ request }) => {
    const response = await request.get("/components/activity-grid.mdx");
    const markdown = await response.text();

    await expect(response).toBeOK();
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

  test("shows GlobalHotkeys in the Theme Hotkey code example", async ({
    page,
  }) => {
    await page.goto("/components/theme-hotkey");

    const exampleTabs = page.getByRole("tablist", {
      name: "Theme Hotkey example",
    });
    await exampleTabs.getByRole("tab", { name: "Code" }).click();
    const examplePanel = exampleTabs.locator("..").getByRole("tabpanel");

    await expect(examplePanel).toContainText("global-hotkeys.tsx");
    await expect(examplePanel).toContainText("<GlobalHotkeys />");
    await expect(examplePanel).not.toContainText("<Tooltip");
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
      await packageManagers
        .getByRole("button", { name: manager, exact: true })
        .click();
      await expect(command).toHaveText(expectedCommand);
    }
  });

  test("keeps installation panel spacing stable across tabs and expansion", async ({
    page,
  }) => {
    await page.goto("/components/floating-tooltip");

    const installTabs = page.getByRole("tablist", {
      name: "Floating Tooltip installation method",
    });
    const installPanel = installTabs.locator("..").getByRole("tabpanel");
    const commandContent = installPanel.locator("[data-installation-content]");
    const documentTop = (locator: typeof commandContent) =>
      locator.evaluate(
        (element) =>
          element.getBoundingClientRect().top +
          (element.ownerDocument.defaultView?.scrollY ?? 0),
      );
    const commandTop = await documentTop(commandContent);

    await installTabs.getByRole("tab", { name: "Manual" }).click();
    const firstCodeFrame = installPanel.locator("[data-code-frame]").first();
    await expect
      .poll(() => documentTop(firstCodeFrame))
      .toBeCloseTo(commandTop, 0);

    await installPanel.getByRole("button", { name: "Expand" }).first().click();
    await expect
      .poll(() => documentTop(firstCodeFrame))
      .toBeCloseTo(commandTop, 0);
  });

  test("rotates the shared arrow when a component link is hovered", async ({
    page,
  }) => {
    const supportsHover = await page.evaluate(
      () => window.matchMedia("(hover: hover)").matches,
    );
    test.skip(!supportsHover, "requires a hover-capable pointer");

    await page.goto("/components");

    const componentLink = page.locator('a[href^="/components/"]').first();
    const arrow = componentLink.locator("[data-rotating-arrow]");
    const restingRotation = await arrow.evaluate(
      (element) => getComputedStyle(element).rotate,
    );

    await expect(arrow).not.toHaveCSS("transition-duration", "0s");

    await componentLink.hover();

    await expect
      .poll(() => arrow.evaluate((element) => getComputedStyle(element).rotate))
      .not.toBe(restingRotation);

    await arrow.hover();
    await expect(arrow).not.toHaveCSS("transition-duration", "0s");
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
