import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchBoundedBytes, fetchBoundedJson } from "@/lib/bounded-fetch";

const options = { maxBytes: 16, timeoutMs: 1_000 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bounded upstream fetch", () => {
  it("rejects an oversized declared response before reading it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("too large", {
            headers: {
              "content-length": "17",
              "content-type": "image/png",
            },
          }),
      ),
    );

    await expect(
      fetchBoundedBytes("https://example.com", options),
    ).rejects.toThrow("exceeds the allowed size");
  });

  it("rejects a streamed response that exceeds the limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("12345678901234567", {
            headers: { "content-type": "image/png" },
          }),
      ),
    );

    await expect(
      fetchBoundedBytes("https://example.com", options),
    ).rejects.toThrow("exceeds the allowed size");
  });

  it("validates JSON before returning upstream data", async () => {
    const schema = z.object({ value: z.number().int() });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"value":1}', {
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(
      fetchBoundedJson("https://example.com", schema, options),
    ).resolves.toEqual({ value: 1 });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"value":"1"}', {
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    await expect(
      fetchBoundedJson("https://example.com", schema, options),
    ).rejects.toThrow();
  });

  it("rejects unexpected content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("not an image", {
            headers: { "content-type": "text/plain" },
          }),
      ),
    );

    await expect(
      fetchBoundedBytes("https://example.com", options),
    ).rejects.toThrow("not an image");
  });
});
