import { z } from "zod";
import type { LogLevel } from "../utils/logger.js";

const authModeSchema = z.enum(["basic", "bearer", "cookie", "header"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const rawConfigSchema = z
  .object({
    CONFLUENCE_BASE_URL: z.string().url(),
    CONFLUENCE_AUTH_MODE: authModeSchema.default("basic"),
    CONFLUENCE_USERNAME: z.string().optional(),
    CONFLUENCE_PASSWORD: z.string().optional(),
    CONFLUENCE_TOKEN: z.string().optional(),
    CONFLUENCE_COOKIE: z.string().optional(),
    CONFLUENCE_AUTH_HEADER_NAME: z.string().optional(),
    CONFLUENCE_AUTH_HEADER_VALUE: z.string().optional(),
    CONFLUENCE_STRICT_SSL: z.string().optional(),
    CONFLUENCE_CA_CERT_PATH: z.string().optional(),
    CONFLUENCE_TIMEOUT_MS: z.string().optional(),
    CONFLUENCE_MAX_RESULTS: z.string().optional(),
    CONFLUENCE_MAX_RESPONSE_BYTES: z.string().optional(),
    CONFLUENCE_MAX_ATTACHMENT_BYTES: z.string().optional(),
    CONFLUENCE_ENABLE_WRITE_TOOLS: z.string().optional(),
    CONFLUENCE_READ_ONLY: z.string().optional(),
    CONFLUENCE_DRY_RUN: z.string().optional(),
    CONFLUENCE_ALLOWED_SPACES: z.string().optional(),
    CONFLUENCE_DENIED_SPACES: z.string().optional(),
    CONFLUENCE_LOG_LEVEL: logLevelSchema.optional(),
    CONFLUENCE_AUDIT_LOG: z.string().optional(),
  })
  .superRefine((value, context) => {
    switch (value.CONFLUENCE_AUTH_MODE) {
      case "basic":
        if (!value.CONFLUENCE_USERNAME) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_USERNAME"],
            message: "CONFLUENCE_USERNAME is required for basic auth.",
          });
        }

        if (!value.CONFLUENCE_PASSWORD && !value.CONFLUENCE_TOKEN) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_PASSWORD"],
            message: "CONFLUENCE_PASSWORD or CONFLUENCE_TOKEN is required for basic auth.",
          });
        }
        break;
      case "bearer":
        if (!value.CONFLUENCE_TOKEN) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_TOKEN"],
            message: "CONFLUENCE_TOKEN is required for bearer auth.",
          });
        }
        break;
      case "cookie":
        if (!value.CONFLUENCE_COOKIE) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_COOKIE"],
            message: "CONFLUENCE_COOKIE is required for cookie auth.",
          });
        }
        break;
      case "header":
        if (!value.CONFLUENCE_AUTH_HEADER_NAME || !value.CONFLUENCE_AUTH_HEADER_VALUE) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["CONFLUENCE_AUTH_HEADER_NAME"],
            message: "CONFLUENCE_AUTH_HEADER_NAME and CONFLUENCE_AUTH_HEADER_VALUE are required for header auth.",
          });
        }
        break;
    }
  });

type AuthMode = z.infer<typeof authModeSchema>;

export interface AppConfig {
  readonly baseUrl: string;
  readonly authMode: AuthMode;
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly cookie?: string;
  readonly authHeaderName?: string;
  readonly authHeaderValue?: string;
  readonly strictSsl: boolean;
  readonly caCertPath?: string;
  readonly caCert?: string;
  readonly timeoutMs: number;
  readonly maxResults: number;
  readonly maxResponseBytes: number;
  readonly maxAttachmentBytes: number;
  readonly enableWriteTools: boolean;
  readonly readOnly: boolean;
  readonly dryRun: boolean;
  readonly allowedSpaces: string[];
  readonly deniedSpaces: string[];
  readonly logLevel: LogLevel;
  readonly auditLog: boolean;
}
