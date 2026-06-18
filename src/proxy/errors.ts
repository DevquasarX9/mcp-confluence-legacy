export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ProxyError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly expose = true,
  ) {
    super(message);
    this.name = "ProxyError";
  }
}

export class UpstreamTimeoutError extends ProxyError {
  public constructor() {
    super(504, "UPSTREAM_TIMEOUT", "upstream Confluence request timed out");
    this.name = "UpstreamTimeoutError";
  }
}

export class UpstreamResponseTooLargeError extends ProxyError {
  public constructor(maxResponseBytes: number) {
    super(
      502,
      "UPSTREAM_RESPONSE_TOO_LARGE",
      `upstream Confluence response exceeded ${maxResponseBytes} bytes`,
    );
    this.name = "UpstreamResponseTooLargeError";
  }
}

export function isProxyError(error: unknown): error is ProxyError {
  return error instanceof ProxyError;
}
