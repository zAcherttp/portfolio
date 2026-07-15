import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createPublicApiGuard } from "@/lib/public-api-security";

function createRequest(
  path: string,
  options: { ip?: string; method?: string } = {},
) {
  return new NextRequest(`https://example.com${path}`, {
    headers: { "x-forwarded-for": options.ip ?? "203.0.113.1" },
    method: options.method ?? "GET",
  });
}

function createTestGuard() {
  return createPublicApiGuard({
    environment: "test",
    redisCredentials: null,
  });
}

describe("public API guard", () => {
  it("allows a registered request and publishes its rate-limit budget", async () => {
    const response = await createTestGuard()(createRequest("/api/favicons"));

    expect(response.status).toBe(200);
    expect(response.headers.get("RateLimit-Limit")).toBe("30");
    expect(response.headers.get("RateLimit-Remaining")).toBe("29");
  });

  it("rejects unsupported methods and query parameters", async () => {
    const guard = createTestGuard();
    const methodResponse = await guard(
      createRequest("/api/favicons", { method: "POST" }),
    );
    const queryResponse = await guard(
      createRequest("/api/github-contributions?username=someone"),
    );

    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("Allow")).toBe("GET, HEAD");
    await expect(methodResponse.json()).resolves.toMatchObject({
      error: { code: "method_not_allowed" },
    });
    expect(queryResponse.status).toBe(400);
    await expect(queryResponse.json()).resolves.toMatchObject({
      error: { code: "unexpected_query_parameters" },
    });
  });

  it("keeps future API routes closed until they have an explicit policy", async () => {
    const response = await createTestGuard()(
      createRequest("/api/unregistered"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "api_not_found" },
    });
  });

  it("limits one client without blocking a different client", async () => {
    const guard = createTestGuard();

    for (let requestCount = 0; requestCount < 30; requestCount += 1) {
      const response = await guard(createRequest("/api/favicons"));
      expect(response.status).toBe(200);
    }

    const limitedResponse = await guard(createRequest("/api/favicons"));
    const otherClientResponse = await guard(
      createRequest("/api/favicons", { ip: "203.0.113.2" }),
    );

    expect(limitedResponse.status).toBe(429);
    expect(Number(limitedResponse.headers.get("Retry-After"))).toBeGreaterThan(
      0,
    );
    expect(otherClientResponse.status).toBe(200);
  });

  it("fails closed in production when distributed limiting is unavailable", async () => {
    const guard = createPublicApiGuard({
      environment: "production",
      redisCredentials: null,
    });
    const response = await guard(createRequest("/api/favicons"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "api_security_unavailable" },
    });
  });
});
