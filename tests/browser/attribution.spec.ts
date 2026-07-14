import { expect, test } from "@playwright/test";

test.describe("outbound attribution", () => {
  test("preserves referrals on external links", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );

    const profileLink = page.locator('a[aria-label="GitHub"]');
    await expect(profileLink).toHaveAttribute("rel", "noopener");
    await expect(profileLink).toHaveAttribute(
      "data-outbound-context",
      "profile",
    );
  });

  test("attributes component links shared to social platforms", async ({
    page,
  }) => {
    await page.goto("/components/transaction-dock");
    await page
      .getByRole("button", { name: "Share component documentation" })
      .click();

    const xHref = await page
      .getByRole("menuitem", { name: "Share on X" })
      .getAttribute("href");
    const linkedInHref = await page
      .getByRole("menuitem", { name: "Share on LinkedIn" })
      .getAttribute("href");

    if (!xHref || !linkedInHref) {
      throw new Error("Social share links are missing their destinations.");
    }

    const xSharedUrl = new URL(xHref).searchParams.get("url");
    const linkedInSharedUrl = new URL(linkedInHref).searchParams.get("url");
    if (!xSharedUrl || !linkedInSharedUrl) {
      throw new Error("Social share links are missing their shared URLs.");
    }

    const xCampaign = new URL(xSharedUrl);
    expect(xCampaign.searchParams.get("utm_source")).toBe("x");
    expect(xCampaign.searchParams.get("utm_medium")).toBe("social");
    expect(xCampaign.searchParams.get("utm_campaign")).toBe("component-share");

    const linkedInCampaign = new URL(linkedInSharedUrl);
    expect(linkedInCampaign.searchParams.get("utm_source")).toBe("linkedin");
    expect(linkedInCampaign.searchParams.get("utm_medium")).toBe("social");
    expect(linkedInCampaign.searchParams.get("utm_campaign")).toBe(
      "component-share",
    );
  });
});
