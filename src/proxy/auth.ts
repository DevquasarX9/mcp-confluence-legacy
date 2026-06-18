import type { IncomingHttpHeaders } from "node:http";
import type { ProxyConfig } from "./config.js";
import { ProxyError } from "./errors.js";
import { timingSafeMatch } from "./security.js";

export const LOCAL_PROXY_TOKEN_HEADER = "x-confluence-proxy-token";

export function validateLocalProxyToken(
  headers: IncomingHttpHeaders,
  expectedToken: string | undefined,
): void {
  if (expectedToken === undefined) {
    return;
  }

  const providedHeader = headers[LOCAL_PROXY_TOKEN_HEADER];
  const provided = Array.isArray(providedHeader) ? providedHeader[0] : providedHeader;

  if (provided === undefined || !timingSafeMatch(expectedToken, provided)) {
    throw new ProxyError(
      401,
      "LOCAL_PROXY_AUTH_FAILED",
      "local Confluence proxy authentication failed",
    );
  }
}

export function buildUpstreamAuthHeaders(config: ProxyConfig): Record<string, string> {
  switch (config.upstreamAuthMode) {
    case "basic": {
      const passwordOrToken = config.upstreamPassword ?? config.upstreamToken ?? "";
      const credentials = Buffer.from(
        `${config.upstreamUsername ?? ""}:${passwordOrToken}`,
        "utf8",
      ).toString("base64");

      return {
        authorization: `Basic ${credentials}`,
      };
    }
    case "bearer":
      return {
        authorization: `Bearer ${config.upstreamToken ?? ""}`,
      };
    case "cookie":
      return {
        cookie: config.upstreamCookie ?? "",
      };
    case "header":
      return {
        [config.upstreamAuthHeaderName ?? "authorization"]:
          config.upstreamAuthHeaderValue ?? "",
      };
    case "none":
      return {};
  }
}
