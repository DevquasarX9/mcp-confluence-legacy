import fs from "node:fs";
import path from "node:path";
import {
  ABSOLUTE_MAX_RESULTS,
  DEFAULT_MAX_ATTACHMENT_BYTES,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_RESULTS,
  DEFAULT_TIMEOUT_MS,
} from "../security/limits.js";
import { normalizeBaseUrl, parseBoolean, parseCsv, parseInteger } from "../utils/validation.js";
import { rawConfigSchema, type AppConfig } from "./schema.js";

function normalizePolicySpaceKeys(value: string | undefined): string[] {
  return parseCsv(value).map((spaceKey) => spaceKey.toUpperCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsedConfig = rawConfigSchema.parse(env);
  const caCertPath =
    parsedConfig.CONFLUENCE_CA_CERT_PATH && parsedConfig.CONFLUENCE_CA_CERT_PATH.trim().length > 0
      ? path.resolve(parsedConfig.CONFLUENCE_CA_CERT_PATH)
      : undefined;

  const maxResults = Math.min(
    parseInteger(parsedConfig.CONFLUENCE_MAX_RESULTS, DEFAULT_MAX_RESULTS),
    ABSOLUTE_MAX_RESULTS,
  );

  return {
    baseUrl: normalizeBaseUrl(parsedConfig.CONFLUENCE_BASE_URL),
    authMode: parsedConfig.CONFLUENCE_AUTH_MODE,
    ...(parsedConfig.CONFLUENCE_USERNAME === undefined ? {} : { username: parsedConfig.CONFLUENCE_USERNAME }),
    ...(parsedConfig.CONFLUENCE_PASSWORD === undefined ? {} : { password: parsedConfig.CONFLUENCE_PASSWORD }),
    ...(parsedConfig.CONFLUENCE_TOKEN === undefined ? {} : { token: parsedConfig.CONFLUENCE_TOKEN }),
    ...(parsedConfig.CONFLUENCE_COOKIE === undefined ? {} : { cookie: parsedConfig.CONFLUENCE_COOKIE }),
    ...(parsedConfig.CONFLUENCE_AUTH_HEADER_NAME === undefined
      ? {}
      : { authHeaderName: parsedConfig.CONFLUENCE_AUTH_HEADER_NAME }),
    ...(parsedConfig.CONFLUENCE_AUTH_HEADER_VALUE === undefined
      ? {}
      : { authHeaderValue: parsedConfig.CONFLUENCE_AUTH_HEADER_VALUE }),
    strictSsl: parseBoolean(parsedConfig.CONFLUENCE_STRICT_SSL, true),
    ...(caCertPath === undefined ? {} : { caCertPath, caCert: fs.readFileSync(caCertPath, "utf8") }),
    timeoutMs: parseInteger(parsedConfig.CONFLUENCE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxResults,
    maxResponseBytes: parseInteger(
      parsedConfig.CONFLUENCE_MAX_RESPONSE_BYTES,
      DEFAULT_MAX_RESPONSE_BYTES,
    ),
    maxAttachmentBytes: parseInteger(
      parsedConfig.CONFLUENCE_MAX_ATTACHMENT_BYTES,
      DEFAULT_MAX_ATTACHMENT_BYTES,
    ),
    enableWriteTools: parseBoolean(parsedConfig.CONFLUENCE_ENABLE_WRITE_TOOLS, false),
    readOnly: parseBoolean(parsedConfig.CONFLUENCE_READ_ONLY, true),
    dryRun: parseBoolean(parsedConfig.CONFLUENCE_DRY_RUN, false),
    allowedSpaces: normalizePolicySpaceKeys(parsedConfig.CONFLUENCE_ALLOWED_SPACES),
    deniedSpaces: normalizePolicySpaceKeys(parsedConfig.CONFLUENCE_DENIED_SPACES),
    logLevel: parsedConfig.CONFLUENCE_LOG_LEVEL ?? "info",
    auditLog: parseBoolean(parsedConfig.CONFLUENCE_AUDIT_LOG, false),
  };
}
