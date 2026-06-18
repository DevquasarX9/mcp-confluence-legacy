import { timingSafeEqual } from "node:crypto";
import { ConfigurationError, ProxyError } from "./errors.js";

const LOCAL_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export interface NormalizedRequestTarget {
  readonly normalizedPath: string;
  readonly queryString: string;
}

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host);
}

export function assertSafeBindHost(host: string, allowNonLocalBind: boolean): void {
  if (!allowNonLocalBind && !isLocalHost(host)) {
    throw new ConfigurationError(
      `refusing to bind to non-local host "${host}" without CONFLUENCE_PROXY_ALLOW_NON_LOCAL_BIND=true`,
    );
  }
}

export function isLoopbackAddress(address: string): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export function timingSafeMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function normalizeAndValidateRequestTarget(rawUrl: string): NormalizedRequestTarget {
  const [rawPath = "", rawQuery = ""] = rawUrl.split("?", 2);

  if (rawPath.length === 0) {
    throw new ProxyError(400, "INVALID_PATH", "request path is required");
  }

  if (/^(?:https?:)?\/\//i.test(rawPath) || /^[a-z][a-z0-9+.-]*:/i.test(rawPath)) {
    throw new ProxyError(403, "ABSOLUTE_URL_FORBIDDEN", "absolute URL paths are not allowed");
  }

  if (!rawPath.startsWith("/")) {
    throw new ProxyError(400, "INVALID_PATH", 'request path must start with "/"');
  }

  if (rawPath.includes("\\") || /%2f|%5c|%2e/i.test(rawPath)) {
    throw new ProxyError(403, "PATH_BYPASS_FORBIDDEN", "encoded or escaped path bypass detected");
  }

  if (rawPath.includes("//")) {
    throw new ProxyError(403, "INVALID_PATH", "duplicate path separators are not allowed");
  }

  const segments = rawPath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === "..") {
        throw new ProxyError(403, "PATH_TRAVERSAL_FORBIDDEN", "path traversal is not allowed");
      }

      return decoded;
    });

  return {
    normalizedPath: `/${segments.join("/")}`.replace(/\/$/, "") || "/",
    queryString: rawQuery,
  };
}
