import { request, type Dispatcher } from "undici";
import type { ProxyConfig } from "./config.js";
import { ProxyError, UpstreamResponseTooLargeError, UpstreamTimeoutError } from "./errors.js";
import { sanitizeResponseHeaders } from "./headers.js";

export interface ForwardRequestOptions {
  readonly config: ProxyConfig;
  readonly dispatcher?: Dispatcher;
  readonly requestImpl?: UpstreamRequestFn;
  readonly method: string;
  readonly normalizedPath: string;
  readonly queryString: string;
  readonly headers: Record<string, string>;
  readonly body?: Buffer;
}

export interface ForwardedResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: Buffer;
}

export interface UpstreamRequestOptions {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: Buffer;
  readonly dispatcher?: Dispatcher;
  readonly signal: AbortSignal;
}

export interface UpstreamRequestResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: AsyncIterable<Uint8Array>;
}

export type UpstreamRequestFn = (
  url: string,
  options: UpstreamRequestOptions,
) => Promise<UpstreamRequestResponse>;

export async function forwardUpstream({
  config,
  dispatcher,
  requestImpl = request as UpstreamRequestFn,
  method,
  normalizedPath,
  queryString,
  headers,
  body,
}: ForwardRequestOptions): Promise<ForwardedResponse> {
  const upstreamUrl = buildUpstreamUrl(config, normalizedPath, queryString);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), config.upstreamTimeoutMs);

  try {
    const response = await requestImpl(upstreamUrl, {
      method,
      headers,
      signal: abortController.signal,
      ...(body === undefined ? {} : { body }),
      ...(dispatcher === undefined ? {} : { dispatcher }),
    });

    const responseBody = await readBodyWithLimit(response.body, config.maxResponseBytes);

    return {
      statusCode: response.statusCode,
      headers: sanitizeResponseHeaders(response.headers),
      body: responseBody,
    };
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new UpstreamTimeoutError();
    }

    if (error instanceof ProxyError) {
      throw error;
    }

    throw new ProxyError(502, "UPSTREAM_REQUEST_FAILED", "failed to call upstream Confluence", false);
  } finally {
    clearTimeout(timeout);
  }
}

export function buildUpstreamUrl(
  config: ProxyConfig,
  normalizedPath: string,
  queryString: string,
): string {
  const baseUrl = new URL(config.upstreamBaseUrl);
  const upstreamUrl = new URL(baseUrl.origin);
  const basePath = baseUrl.pathname === "/" ? "" : baseUrl.pathname.replace(/\/$/, "");

  upstreamUrl.pathname = `${basePath}${normalizedPath}`;
  upstreamUrl.search = queryString;

  return upstreamUrl.toString();
}

async function readBodyWithLimit(
  body: AsyncIterable<Uint8Array>,
  maxResponseBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;

    if (size > maxResponseBytes) {
      throw new UpstreamResponseTooLargeError(maxResponseBytes);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}
