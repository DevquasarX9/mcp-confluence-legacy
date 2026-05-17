import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type JsonRecord = Record<string, unknown>;
export type JsonValue = unknown;

interface SuccessPayload {
  ok: true;
  operation: string;
  data: unknown;
  meta?: JsonRecord;
}

interface ErrorPayload {
  ok: false;
  operation: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function textResult(payload: SuccessPayload | ErrorPayload, isError = false): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload as unknown as Record<string, unknown>,
    ...(isError ? { isError: true } : {}),
  };
}

export function toolSuccess(operation: string, data: unknown, meta?: JsonRecord): CallToolResult {
  return textResult(
    meta === undefined ? { ok: true, operation, data } : { ok: true, operation, data, meta },
  );
}

export function toolError(
  operation: string,
  code: string,
  message: string,
  details?: unknown,
): CallToolResult {
  return textResult(
    details === undefined
      ? {
          ok: false,
          operation,
          error: { code, message },
        }
      : {
          ok: false,
          operation,
          error: { code, message, details },
        },
    true,
  );
}

export function asJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => asJsonValue(entry));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<JsonRecord>((accumulator, [key, entry]) => {
      accumulator[key] = asJsonValue(entry);
      return accumulator;
    }, {});
  }

  return String(value);
}
