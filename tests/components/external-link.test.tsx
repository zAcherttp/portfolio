import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExternalLink } from "@/components/ExternalLink";

describe("ExternalLink", () => {
  it("preserves referral attribution and secures new tabs", () => {
    render(
      <ExternalLink
        attributionContext="project"
        href="https://example.com/project"
        rel="nofollow noreferrer"
        target="_blank"
      >
        Project
      </ExternalLink>,
    );

    const link = screen.getByRole("link", { name: "Project" });
    expect(link).toHaveAttribute("rel", "nofollow noopener");
    expect(link).toHaveAttribute("data-outbound-context", "project");
    expect(link).toHaveAttribute("data-outbound-link", "");
  });

  it("supports an explicit no-referrer escape hatch", () => {
    render(
      <ExternalLink
        attributionContext="profile"
        href="https://example.com/private"
        noReferrer
        target="_blank"
      >
        Private destination
      </ExternalLink>,
    );

    expect(
      screen.getByRole("link", { name: "Private destination" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not instrument relative links", () => {
    render(
      <ExternalLink
        attributionContext="docs-reference"
        href="/components/transaction-dock"
      >
        Transaction Dock
      </ExternalLink>,
    );

    const link = screen.getByRole("link", { name: "Transaction Dock" });
    expect(link).not.toHaveAttribute("data-outbound-link");
    expect(link).not.toHaveAttribute("rel");
  });
});
