export class ConfluenceClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ConfluenceClientError";
  }
}

export function normalizeConfluenceErrorMessage(status: number, body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }

    if (typeof record.errorMessage === "string" && record.errorMessage.length > 0) {
      return record.errorMessage;
    }

    const errorMessages = Array.isArray(record.errorMessages)
      ? record.errorMessages.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (errorMessages.length > 0) {
      return errorMessages.join("; ");
    }

    if (record.errors && typeof record.errors === "object") {
      const fieldErrors = Object.values(record.errors as Record<string, unknown>).filter(
        (entry): entry is string => typeof entry === "string",
      );

      if (fieldErrors.length > 0) {
        return fieldErrors.join("; ");
      }
    }
  }

  if (status === 401) {
    return "Confluence authentication failed.";
  }

  if (status === 403) {
    return "Confluence request was forbidden.";
  }

  if (status === 404) {
    return "Confluence resource was not found or is not visible to the authenticated user.";
  }

  if (status === 409) {
    return "Confluence request conflicted with the current content version.";
  }

  return fallback;
}
