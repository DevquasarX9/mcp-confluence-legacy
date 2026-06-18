import { readFileSync } from "node:fs";
import { z } from "zod";
import type { LogLevel } from "../utils/logger.js";
import { ConfigurationError } from "./errors.js";
import { assertSafeBindHost } from "./security.js";

const booleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalNonEmptyStringSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

const portSchema = z.coerce.number().int().min(1).max(65535);
const positiveIntegerSchema = z.coerce.number().int().positive();
const upstreamAuthModeSchema = z.enum(["basic", "bearer", "cookie", "header", "none"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const proxyEnvSchema = z
  .object({
    CONFLUENCE_UPSTREAM_BASE_URL: z.string().url(),
    CONFLUENCE_UPSTREAM_AUTH_MODE: upstreamAuthModeSchema,
    CONFLUENCE_UPSTREAM_USERNAME: optionalNonEmptyStringSchema,
    CONFLUENCE_UPSTREAM_PASSWORD: optionalNonEmptyStringSchema,
    CONFLUENCE_UPSTREAM_TOKEN: optionalNonEmptyStringSchema,
    CONFLUENCE_UPSTREAM_COOKIE: optionalNonEmptyStringSchema,
    CONFLUENCE_UPSTREAM_AUTH_HEADER_NAME: optionalNonEmptyStringSchema,
    CONFLUENCE_UPSTREAM_AUTH_HEADER_VALUE: optionalNonEmptyStringSchema,
    CONFLUENCE_PROXY_HOST: z.string().default("127.0.0.1"),
    CONFLUENCE_PROXY_PORT: portSchema.default(4878),
    CONFLUENCE_LOCAL_PROXY_TOKEN: optionalNonEmptyStringSchema,
    CONFLUENCE_PROXY_READ_ONLY: booleanSchema.default(true),
    CONFLUENCE_PROXY_ENABLE_WRITE: booleanSchema.default(false),
    CONFLUENCE_PROXY_ENABLE_ATTACHMENTS: booleanSchema.default(false),
    CONFLUENCE_PROXY_MAX_REQUEST_BYTES: positiveIntegerSchema.default(1_048_576),
    CONFLUENCE_PROXY_MAX_RESPONSE_BYTES: positiveIntegerSchema.default(10_485_760),
    CONFLUENCE_PROXY_UPSTREAM_TIMEOUT_MS: positiveIntegerSchema.default(30_000),
    CONFLUENCE_PROXY_STRICT_SSL: booleanSchema.default(true),
    CONFLUENCE_PROXY_CA_CERT_PATH: optionalNonEmptyStringSchema,
    CONFLUENCE_PROXY_LOG_LEVEL: logLevelSchema.default("info"),
    CONFLUENCE_PROXY_ALLOW_NON_LOCAL_BIND: booleanSchema.default(false),
  })
  .superRefine((value, context) => {
    switch (value.CONFLUENCE_UPSTREAM_AUTH_MODE) {
      case "basic":
        if (value.CONFLUENCE_UPSTREAM_USERNAME === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_UPSTREAM_USERNAME"],
            message: "CONFLUENCE_UPSTREAM_USERNAME is required when CONFLUENCE_UPSTREAM_AUTH_MODE=basic",
          });
        }

        if (
          value.CONFLUENCE_UPSTREAM_PASSWORD === undefined &&
          value.CONFLUENCE_UPSTREAM_TOKEN === undefined
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_UPSTREAM_PASSWORD"],
            message:
              "CONFLUENCE_UPSTREAM_PASSWORD or CONFLUENCE_UPSTREAM_TOKEN is required when CONFLUENCE_UPSTREAM_AUTH_MODE=basic",
          });
        }
        break;
      case "bearer":
        if (value.CONFLUENCE_UPSTREAM_TOKEN === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_UPSTREAM_TOKEN"],
            message: "CONFLUENCE_UPSTREAM_TOKEN is required when CONFLUENCE_UPSTREAM_AUTH_MODE=bearer",
          });
        }
        break;
      case "cookie":
        if (value.CONFLUENCE_UPSTREAM_COOKIE === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_UPSTREAM_COOKIE"],
            message: "CONFLUENCE_UPSTREAM_COOKIE is required when CONFLUENCE_UPSTREAM_AUTH_MODE=cookie",
          });
        }
        break;
      case "header":
        if (
          value.CONFLUENCE_UPSTREAM_AUTH_HEADER_NAME === undefined ||
          value.CONFLUENCE_UPSTREAM_AUTH_HEADER_VALUE === undefined
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_UPSTREAM_AUTH_HEADER_NAME"],
            message:
              "CONFLUENCE_UPSTREAM_AUTH_HEADER_NAME and CONFLUENCE_UPSTREAM_AUTH_HEADER_VALUE are required when CONFLUENCE_UPSTREAM_AUTH_MODE=header",
          });
        }
        break;
      case "none":
        break;
    }

    if (value.CONFLUENCE_PROXY_READ_ONLY && value.CONFLUENCE_PROXY_ENABLE_WRITE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CONFLUENCE_PROXY_ENABLE_WRITE"],
        message: "CONFLUENCE_PROXY_ENABLE_WRITE=true requires CONFLUENCE_PROXY_READ_ONLY=false",
      });
    }
  });

export type UpstreamAuthMode = z.infer<typeof upstreamAuthModeSchema>;

export interface ProxyConfig {
  readonly upstreamBaseUrl: string;
  readonly upstreamAuthMode: UpstreamAuthMode;
  readonly upstreamUsername?: string;
  readonly upstreamPassword?: string;
  readonly upstreamToken?: string;
  readonly upstreamCookie?: string;
  readonly upstreamAuthHeaderName?: string;
  readonly upstreamAuthHeaderValue?: string;
  readonly proxyHost: string;
  readonly proxyPort: number;
  readonly localProxyToken?: string;
  readonly proxyReadOnly: boolean;
  readonly proxyEnableWrite: boolean;
  readonly proxyEnableAttachments: boolean;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly upstreamTimeoutMs: number;
  readonly strictSsl: boolean;
  readonly caCertPath?: string;
  readonly caCert?: string;
  readonly logLevel: LogLevel;
  readonly allowNonLocalBind: boolean;
}

export function loadProxyConfig(env: NodeJS.ProcessEnv = process.env): ProxyConfig {
  const parsed = proxyEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigurationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const data = parsed.data;
  assertSafeBindHost(data.CONFLUENCE_PROXY_HOST, data.CONFLUENCE_PROXY_ALLOW_NON_LOCAL_BIND);

  return {
    upstreamBaseUrl: sanitizeBaseUrl(data.CONFLUENCE_UPSTREAM_BASE_URL),
    upstreamAuthMode: data.CONFLUENCE_UPSTREAM_AUTH_MODE,
    proxyHost: data.CONFLUENCE_PROXY_HOST,
    proxyPort: data.CONFLUENCE_PROXY_PORT,
    proxyReadOnly: data.CONFLUENCE_PROXY_READ_ONLY,
    proxyEnableWrite: data.CONFLUENCE_PROXY_ENABLE_WRITE,
    proxyEnableAttachments: data.CONFLUENCE_PROXY_ENABLE_ATTACHMENTS,
    maxRequestBytes: data.CONFLUENCE_PROXY_MAX_REQUEST_BYTES,
    maxResponseBytes: data.CONFLUENCE_PROXY_MAX_RESPONSE_BYTES,
    upstreamTimeoutMs: data.CONFLUENCE_PROXY_UPSTREAM_TIMEOUT_MS,
    strictSsl: data.CONFLUENCE_PROXY_STRICT_SSL,
    logLevel: data.CONFLUENCE_PROXY_LOG_LEVEL,
    allowNonLocalBind: data.CONFLUENCE_PROXY_ALLOW_NON_LOCAL_BIND,
    ...(data.CONFLUENCE_UPSTREAM_USERNAME === undefined
      ? {}
      : { upstreamUsername: data.CONFLUENCE_UPSTREAM_USERNAME }),
    ...(data.CONFLUENCE_UPSTREAM_PASSWORD === undefined
      ? {}
      : { upstreamPassword: data.CONFLUENCE_UPSTREAM_PASSWORD }),
    ...(data.CONFLUENCE_UPSTREAM_TOKEN === undefined
      ? {}
      : { upstreamToken: data.CONFLUENCE_UPSTREAM_TOKEN }),
    ...(data.CONFLUENCE_UPSTREAM_COOKIE === undefined
      ? {}
      : { upstreamCookie: data.CONFLUENCE_UPSTREAM_COOKIE }),
    ...(data.CONFLUENCE_UPSTREAM_AUTH_HEADER_NAME === undefined
      ? {}
      : { upstreamAuthHeaderName: data.CONFLUENCE_UPSTREAM_AUTH_HEADER_NAME }),
    ...(data.CONFLUENCE_UPSTREAM_AUTH_HEADER_VALUE === undefined
      ? {}
      : { upstreamAuthHeaderValue: data.CONFLUENCE_UPSTREAM_AUTH_HEADER_VALUE }),
    ...(data.CONFLUENCE_LOCAL_PROXY_TOKEN === undefined
      ? {}
      : { localProxyToken: data.CONFLUENCE_LOCAL_PROXY_TOKEN }),
    ...(data.CONFLUENCE_PROXY_CA_CERT_PATH === undefined
      ? {}
      : {
          caCertPath: data.CONFLUENCE_PROXY_CA_CERT_PATH,
          caCert: readFileSync(data.CONFLUENCE_PROXY_CA_CERT_PATH, "utf8"),
        }),
  };
}

function sanitizeBaseUrl(rawBaseUrl: string): string {
  const url = new URL(rawBaseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ConfigurationError("CONFLUENCE_UPSTREAM_BASE_URL must use http or https");
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new ConfigurationError("CONFLUENCE_UPSTREAM_BASE_URL must not contain credentials");
  }

  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}
