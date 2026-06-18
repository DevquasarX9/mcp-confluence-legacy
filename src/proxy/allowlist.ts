import type { ProxyConfig } from "./config.js";

export interface RouteRule {
  readonly method: string;
  readonly pattern: string;
  readonly access: "read" | "write";
}

export interface AllowlistDecision {
  readonly allowed: boolean;
  readonly reason: "allowed" | "route_not_allowed" | "read_only";
  readonly access?: "read" | "write";
}

const READ_RULES: RouteRule[] = [
  { method: "GET", pattern: "/rest/api/content/search", access: "read" },
  { method: "GET", pattern: "/rest/api/content/*", access: "read" },
  { method: "GET", pattern: "/rest/api/content/*/child/page", access: "read" },
  { method: "GET", pattern: "/rest/api/content/*/child/comment", access: "read" },
  { method: "GET", pattern: "/rest/api/content/*/child/attachment", access: "read" },
  { method: "GET", pattern: "/rest/api/content/*/label", access: "read" },
  { method: "GET", pattern: "/rest/api/space", access: "read" },
  { method: "GET", pattern: "/rest/api/space/*", access: "read" },
];

const WRITE_RULES: RouteRule[] = [
  { method: "POST", pattern: "/rest/api/content", access: "write" },
  { method: "PUT", pattern: "/rest/api/content/*", access: "write" },
  { method: "POST", pattern: "/rest/api/content/*/label", access: "write" },
];

const ATTACHMENT_WRITE_RULES: RouteRule[] = [
  { method: "POST", pattern: "/rest/api/content/*/child/attachment", access: "write" },
];

export function buildAllowlist(config: ProxyConfig): RouteRule[] {
  if (!config.proxyEnableWrite) {
    return READ_RULES;
  }

  return [
    ...READ_RULES,
    ...WRITE_RULES,
    ...(config.proxyEnableAttachments ? ATTACHMENT_WRITE_RULES : []),
  ];
}

export function evaluateRouteAccess(
  config: ProxyConfig,
  method: string,
  normalizedPath: string,
): AllowlistDecision {
  const matchedRule = buildAllowlist(config).find((rule) => {
    if (rule.method !== method.toUpperCase()) {
      return false;
    }

    return matchPattern(rule.pattern, normalizedPath);
  });

  if (matchedRule === undefined) {
    return {
      allowed: false,
      reason: "route_not_allowed",
    };
  }

  if (config.proxyReadOnly && matchedRule.access === "write") {
    return {
      allowed: false,
      reason: "read_only",
      access: "write",
    };
  }

  return {
    allowed: true,
    reason: "allowed",
    access: matchedRule.access,
  };
}

export function matchPattern(pattern: string, normalizedPath: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    if (segment === "*") {
      return pathSegments[index] !== undefined && pathSegments[index].length > 0;
    }

    return segment === pathSegments[index];
  });
}
