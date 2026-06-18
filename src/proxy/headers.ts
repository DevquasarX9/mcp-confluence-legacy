import type { IncomingHttpHeaders } from "node:http";
import type { ProxyConfig } from "./config.js";
import { buildUpstreamAuthHeaders, LOCAL_PROXY_TOKEN_HEADER } from "./auth.js";

const BLOCKED_INBOUND_HEADERS = new Set([
  "accept-encoding",
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  LOCAL_PROXY_TOKEN_HEADER,
]);

const BLOCKED_RESPONSE_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export function buildUpstreamHeaders(
  config: ProxyConfig,
  inboundHeaders: IncomingHttpHeaders,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(inboundHeaders)) {
    const name = rawName.toLowerCase();
    if (BLOCKED_INBOUND_HEADERS.has(name) || rawValue === undefined) {
      continue;
    }

    headers[name] = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
  }

  return {
    ...headers,
    ...buildUpstreamAuthHeaders(config),
  };
}

export function sanitizeResponseHeaders(
  upstreamHeaders: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [rawName, rawValue] of Object.entries(upstreamHeaders)) {
    const name = rawName.toLowerCase();
    if (BLOCKED_RESPONSE_HEADERS.has(name) || rawValue === undefined) {
      continue;
    }

    headers[name] = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue;
  }

  return headers;
}
