import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutboundLinkTracker } from "@/components/OutboundLinkTracker";

const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/analytics", () => ({ track: trackMock }));

describe("OutboundLinkTracker", () => {
  beforeEach(() => trackMock.mockClear());

  it("records bounded outbound data without query parameters", () => {
    render(
      <>
        <OutboundLinkTracker />
        <a
          data-outbound-context="bookmark"
          href="https://example.com/private/report?token=secret"
          onClick={(event) => event.preventDefault()}
        >
          <span>External destination</span>
        </a>
      </>,
    );

    fireEvent.click(screen.getByText("External destination"));

    expect(trackMock).toHaveBeenCalledOnce();
    expect(trackMock).toHaveBeenCalledWith("Outbound Link", {
      context: "bookmark",
      destinationHost: "example.com",
      destinationPath: "/private",
    });
  });

  it("ignores same-origin links", () => {
    render(
      <>
        <OutboundLinkTracker />
        <a href="/components/kbd" onClick={(event) => event.preventDefault()}>
          KBD
        </a>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "KBD" }));
    expect(trackMock).not.toHaveBeenCalled();
  });
});
