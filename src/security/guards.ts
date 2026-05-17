import type { AppConfig } from "../config/schema.js";
import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  DEFAULT_MAX_BODY_LENGTH,
  DEFAULT_MAX_CQL_LENGTH,
  DEFAULT_MAX_LABELS,
} from "./limits.js";

export class GuardError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GuardError";
  }
}

function normalizeSpaceKeyForPolicy(spaceKey: string): string {
  return spaceKey.trim().toUpperCase();
}

export function ensureSpaceAllowed(config: AppConfig, spaceKey: string): void {
  const normalizedSpaceKey = normalizeSpaceKeyForPolicy(spaceKey);

  if (
    config.deniedSpaces.includes(normalizedSpaceKey) ||
    (config.allowedSpaces.length > 0 && !config.allowedSpaces.includes(normalizedSpaceKey))
  ) {
    throw new GuardError(
      "SPACE_NOT_ALLOWED",
      `Space ${spaceKey} is not allowed by server policy.`,
    );
  }
}

export function filterAllowedSpaces<T extends { key?: string }>(config: AppConfig, spaces: T[]): T[] {
  return spaces.filter((space) => {
    if (!space.key) {
      return true;
    }

    try {
      ensureSpaceAllowed(config, space.key);
      return true;
    } catch {
      return false;
    }
  });
}

export function ensureWriteAllowed(config: AppConfig, operation: string): void {
  if (config.readOnly) {
    throw new GuardError("READ_ONLY_MODE", `${operation} is disabled because CONFLUENCE_READ_ONLY=true.`);
  }

  if (!config.enableWriteTools) {
    throw new GuardError(
      "WRITE_TOOLS_DISABLED",
      `${operation} is disabled because CONFLUENCE_ENABLE_WRITE_TOOLS=false.`,
    );
  }
}

export function ensureBodyLength(body: string): void {
  if (body.length > DEFAULT_MAX_BODY_LENGTH) {
    throw new GuardError(
      "BODY_TOO_LARGE",
      `Body exceeds the maximum supported length of ${DEFAULT_MAX_BODY_LENGTH} characters.`,
    );
  }
}

export function ensureCqlLength(cql: string): void {
  if (cql.length > DEFAULT_MAX_CQL_LENGTH) {
    throw new GuardError(
      "CQL_TOO_LARGE",
      `CQL exceeds the maximum supported length of ${DEFAULT_MAX_CQL_LENGTH} characters.`,
    );
  }
}

export function ensureLabelsAllowed(labels: readonly unknown[]): void {
  if (labels.length > DEFAULT_MAX_LABELS) {
    throw new GuardError(
      "TOO_MANY_LABELS",
      `At most ${DEFAULT_MAX_LABELS} labels can be added in one request.`,
    );
  }
}

export function ensureAttachmentAllowed(config: AppConfig, bytes: number): void {
  ensureWriteAllowed(config, "confluence_upload_attachment");

  if (bytes > config.maxAttachmentBytes || bytes > DEFAULT_MAX_ATTACHMENT_BYTES) {
    throw new GuardError(
      "ATTACHMENT_TOO_LARGE",
      `Attachment exceeds the maximum supported size of ${config.maxAttachmentBytes} bytes.`,
    );
  }
}

function quoteCqlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

export function scopeCql(config: AppConfig, cql: string): string {
  const clauses: string[] = [];

  if (config.allowedSpaces.length > 0) {
    clauses.push(`space in (${config.allowedSpaces.map(quoteCqlString).join(", ")})`);
  }

  if (config.deniedSpaces.length > 0) {
    clauses.push(`space not in (${config.deniedSpaces.map(quoteCqlString).join(", ")})`);
  }

  clauses.push(`(${cql.trim()})`);

  const scopedCql = clauses.join(" AND ");
  ensureCqlLength(scopedCql);
  return scopedCql;
}
