import { describe, expect, it } from "vitest";
import {
  getOutboundPathGroup,
  isExternalHttpHref,
  normalizeOutboundContext,
  withUtmParameters,
} from "@/lib/attribution";

describe("attribution utilities", () => {
  it("recognizes external HTTP links without treating local protocols as external", () => {
    expect(isExternalHttpHref("https://example.com/path")).toBe(true);
    expect(isExternalHttpHref("//example.com/path")).toBe(true);
    expect(isExternalHttpHref("/components/kbd")).toBe(false);
    expect(isExternalHttpHref("mailto:hello@example.com")).toBe(false);
    expect(isExternalHttpHref("tel:+123456789")).toBe(false);
  });

  it("adds campaign parameters while preserving URL state", () => {
    const attributed = new URL(
      withUtmParameters("https://example.com/post?preview=1#details", {
        source: "x",
        medium: "social",
        campaign: "component-share",
      }),
    );

    expect(attributed.searchParams.get("preview")).toBe("1");
    expect(attributed.searchParams.get("utm_source")).toBe("x");
    expect(attributed.searchParams.get("utm_medium")).toBe("social");
    expect(attributed.searchParams.get("utm_campaign")).toBe("component-share");
    expect(attributed.hash).toBe("#details");
  });

  it("does not overwrite campaign parameters supplied by the destination", () => {
    const attributed = new URL(
      withUtmParameters("https://example.com/?utm_source=publisher", {
        source: "portfolio",
        medium: "referral",
        campaign: "component-credits",
      }),
    );

    expect(attributed.searchParams.get("utm_source")).toBe("publisher");
    expect(attributed.searchParams.get("utm_medium")).toBe("referral");
  });

  it("leaves relative and non-HTTP links untouched", () => {
    const campaign = {
      source: "portfolio",
      medium: "referral",
      campaign: "test",
    };

    expect(withUtmParameters("/components/kbd?tab=code", campaign)).toBe(
      "/components/kbd?tab=code",
    );
    expect(withUtmParameters("mailto:hello@example.com", campaign)).toBe(
      "mailto:hello@example.com",
    );
  });

  it("bounds analytics dimensions to known contexts and one path segment", () => {
    expect(normalizeOutboundContext("bookmark")).toBe("bookmark");
    expect(normalizeOutboundContext("user-controlled-value")).toBe(
      "unclassified",
    );
    expect(getOutboundPathGroup("/account/private/report")).toBe("/account");
    expect(getOutboundPathGroup("/")).toBe("/");
  });
});
