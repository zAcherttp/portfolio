import { createHash } from "node:crypto";
import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";

type RateLimit = {
  requests: number;
  window: Duration;
  windowMs: number;
};

type PublicApiPolicy = {
  id: string;
  allowedMethods: readonly string[];
  allowedSearchParameters: readonly string[];
  perClient: RateLimit;
  global: RateLimit;
};

export const PUBLIC_API_POLICIES = {
  "/api/favicons": {
    id: "favicons",
    allowedMethods: ["GET", "HEAD"],
    allowedSearchParameters: [],
    perClient: { requests: 30, window: "1 m", windowMs: 60_000 },
    global: { requests: 600, window: "1 m", windowMs: 60_000 },
  },
  "/api/github-contributions": {
    id: "github-contributions",
    allowedMethods: ["GET", "HEAD"],
    allowedSearchParameters: [],
    perClient: { requests: 30, window: "1 m", windowMs: 60_000 },
    global: { requests: 600, window: "1 m", windowMs: 60_000 },
  },
} as const satisfies Record<string, PublicApiPolicy>;

type RateLimitScope = "client" | "global";

type RateLimitDecision = {
  available: boolean;
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
};

interface RateLimitBackend {
  limit(
    policy: PublicApiPolicy,
    scope: RateLimitScope,
    identifier: string,
  ): Promise<RateLimitDecision>;
}

type RedisCredentials = {
  url: string;
  token: string;
};

type CreatePublicApiGuardOptions = {
  environment?: string;
  redisCredentials?: RedisCredentials | null;
  now?: () => number;
};

class UpstashRateLimitBackend implements RateLimitBackend {
  private readonly limiters = new Map<string, Ratelimit>();

  constructor(private readonly redis: Redis) {}

  async limit(
    policy: PublicApiPolicy,
    scope: RateLimitScope,
    identifier: string,
  ): Promise<RateLimitDecision> {
    const rate = policy[scope === "client" ? "perClient" : "global"];
    const limiterKey = `${policy.id}:${scope}`;
    let limiter = this.limiters.get(limiterKey);

    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(rate.requests, rate.window),
        prefix: `portfolio:public-api:${limiterKey}`,
        timeout: 1_000,
      });
      this.limiters.set(limiterKey, limiter);
    }

    const result = await limiter.limit(identifier);
    return {
      available: result.reason !== "timeout",
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      pending: result.pending,
    };
  }
}

class InMemoryRateLimitBackend implements RateLimitBackend {
  private readonly requests = new Map<string, number[]>();

  constructor(private readonly now: () => number) {}

  async limit(
    policy: PublicApiPolicy,
    scope: RateLimitScope,
    identifier: string,
  ): Promise<RateLimitDecision> {
    const rate = policy[scope === "client" ? "perClient" : "global"];
    const now = this.now();
    const key = `${policy.id}:${scope}:${identifier}`;
    const recentRequests = (this.requests.get(key) ?? []).filter(
      (timestamp) => timestamp > now - rate.windowMs,
    );
    const reset = (recentRequests[0] ?? now) + rate.windowMs;

    if (recentRequests.length >= rate.requests) {
      this.requests.set(key, recentRequests);
      return {
        available: true,
        success: false,
        limit: rate.requests,
        remaining: 0,
        reset,
        pending: Promise.resolve(),
      };
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return {
      available: true,
      success: true,
      limit: rate.requests,
      remaining: rate.requests - recentRequests.length,
      reset,
      pending: Promise.resolve(),
    };
  }
}

class UnavailableRateLimitBackend implements RateLimitBackend {
  async limit(): Promise<RateLimitDecision> {
    return {
      available: false,
      success: false,
      limit: 0,
      remaining: 0,
      reset: Date.now(),
      pending: Promise.resolve(),
    };
  }
}

function createRateLimitBackend(
  options: CreatePublicApiGuardOptions,
): RateLimitBackend {
  const credentials =
    options.redisCredentials === undefined
      ? readRedisCredentials()
      : options.redisCredentials;

  if (credentials) {
    return new UpstashRateLimitBackend(new Redis(credentials));
  }

  if ((options.environment ?? process.env.NODE_ENV) === "production") {
    return new UnavailableRateLimitBackend();
  }

  return new InMemoryRateLimitBackend(options.now ?? Date.now);
}

function readRedisCredentials(): RedisCredentials | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const clientIp = forwardedFor.split(",", 1)[0]?.trim() || "unknown";

  return createHash("sha256").update(clientIp).digest("hex").slice(0, 32);
}

function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const resetSeconds = Math.max(
    0,
    Math.ceil((decision.reset - Date.now()) / 1_000),
  );
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(resetSeconds),
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        ...headers,
      },
    },
  );
}

function rateLimitExceededResponse(decision: RateLimitDecision) {
  const headers = rateLimitHeaders(decision);
  return errorResponse(
    429,
    "rate_limit_exceeded",
    "Too many requests. Try again later.",
    {
      ...headers,
      "Retry-After": headers["RateLimit-Reset"] ?? "1",
    },
  );
}

export function createPublicApiGuard(
  options: CreatePublicApiGuardOptions = {},
) {
  const backend = createRateLimitBackend(options);

  return async function guardPublicApi(
    request: NextRequest,
    event?: Pick<NextFetchEvent, "waitUntil">,
  ): Promise<NextResponse> {
    const policy = PUBLIC_API_POLICIES[
      request.nextUrl.pathname as keyof typeof PUBLIC_API_POLICIES
    ] as PublicApiPolicy | undefined;

    if (!policy) {
      return errorResponse(404, "api_not_found", "API endpoint not found.");
    }

    const clientIdentifier = getClientIdentifier(request);
    let clientDecision: RateLimitDecision;

    try {
      clientDecision = await backend.limit(policy, "client", clientIdentifier);
    } catch {
      return errorResponse(
        503,
        "api_security_unavailable",
        "API protection is temporarily unavailable.",
      );
    }

    event?.waitUntil(clientDecision.pending);

    if (!clientDecision.available) {
      return errorResponse(
        503,
        "api_security_unavailable",
        "API protection is temporarily unavailable.",
      );
    }

    if (!clientDecision.success) {
      return rateLimitExceededResponse(clientDecision);
    }

    const successHeaders = rateLimitHeaders(clientDecision);

    if (!policy.allowedMethods.includes(request.method)) {
      return errorResponse(405, "method_not_allowed", "Method not allowed.", {
        ...successHeaders,
        Allow: policy.allowedMethods.join(", "),
      });
    }

    const unexpectedSearchParameters = [
      ...request.nextUrl.searchParams.keys(),
    ].filter((key) => !policy.allowedSearchParameters.includes(key));
    if (unexpectedSearchParameters.length > 0) {
      return errorResponse(
        400,
        "unexpected_query_parameters",
        "This endpoint does not accept query parameters.",
        successHeaders,
      );
    }

    let globalDecision: RateLimitDecision;
    try {
      globalDecision = await backend.limit(policy, "global", "all-clients");
    } catch {
      return errorResponse(
        503,
        "api_security_unavailable",
        "API protection is temporarily unavailable.",
      );
    }

    event?.waitUntil(globalDecision.pending);

    if (!globalDecision.available) {
      return errorResponse(
        503,
        "api_security_unavailable",
        "API protection is temporarily unavailable.",
      );
    }

    if (!globalDecision.success) {
      return rateLimitExceededResponse(globalDecision);
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(successHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  };
}
