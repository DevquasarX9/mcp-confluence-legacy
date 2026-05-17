import { ABSOLUTE_MAX_RESULTS } from "../security/limits.js";
import { clampNumber } from "./validation.js";

export interface PageRequest {
  readonly start?: number | undefined;
  readonly limit?: number | undefined;
}

export function normalizePagination(
  request: PageRequest,
  configuredMaxResults: number,
): { start: number; limit: number } {
  return {
    start: clampNumber(request.start ?? 0, 0, Number.MAX_SAFE_INTEGER),
    limit: clampNumber(request.limit ?? configuredMaxResults, 1, Math.min(configuredMaxResults, ABSOLUTE_MAX_RESULTS)),
  };
}
