import type { ZodType } from "zod";

type BoundedFetchOptions = {
  maxBytes: number;
  timeoutMs: number;
};

type BoundedBytes = {
  bytes: Uint8Array;
  contentType: string;
};

async function fetchBoundedResponse(
  url: string,
  options: BoundedFetchOptions,
): Promise<Response> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Upstream request failed with status ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
    throw new Error("Upstream response exceeds the allowed size");
  }

  return response;
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("Response size limit exceeded");
      throw new Error("Upstream response exceeds the allowed size");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function fetchBoundedBytes(
  url: string,
  options: BoundedFetchOptions,
): Promise<BoundedBytes> {
  const response = await fetchBoundedResponse(url, options);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Upstream response is not an image");
  }

  return {
    bytes: await readBoundedBody(response, options.maxBytes),
    contentType,
  };
}

export async function fetchBoundedJson<T>(
  url: string,
  schema: ZodType<T>,
  options: BoundedFetchOptions,
): Promise<T> {
  const response = await fetchBoundedResponse(url, options);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("+json")
  ) {
    throw new Error("Upstream response is not JSON");
  }

  const bytes = await readBoundedBody(response, options.maxBytes);
  const json: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return schema.parse(json);
}
