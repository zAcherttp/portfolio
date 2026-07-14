import type { NextFetchEvent, NextRequest } from "next/server";
import { createPublicApiGuard } from "@/lib/public-api-security";

const guardPublicApi = createPublicApiGuard();

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return guardPublicApi(request, event);
}

export const config = {
  matcher: "/api/:path*",
};
