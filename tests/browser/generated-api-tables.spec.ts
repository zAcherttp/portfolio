import { expect, test } from "@playwright/test";

const generatedApiPages = [
  {
    slug: "dither-footer",
    props: ["active", "className", "testId"],
  },
  {
    slug: "theme-hotkey",
    props: ["shortcut", "throttleMs", "ignoreInputs"],
  },
  {
    slug: "kbd",
    props: ["pressed", "reactive", "keyName", "className", "children"],
  },
] as const;

test.describe("generated API tables", () => {
  for (const { slug, props } of generatedApiPages) {
    test(`${slug} renders its generated public props`, async ({ page }) => {
      await page.goto(`/components/${slug}`);

      const heading = page.getByRole("heading", { name: "API reference" });
      const apiTable = heading.locator("xpath=following-sibling::div[1]");

      await expect(apiTable.locator("table")).toBeVisible();
      await expect(apiTable.getByRole("row")).toHaveCount(props.length + 1);

      for (const prop of props) {
        await expect(
          apiTable.getByRole("cell", { name: new RegExp(`^${prop}\\??$`) }),
        ).toBeVisible();
      }
    });
  }
});
