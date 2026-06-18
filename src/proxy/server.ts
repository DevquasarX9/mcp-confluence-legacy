import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Agent, request, type Dispatcher } from "undici";
import { evaluateRouteAccess } from "./allowlist.js";
import { validateLocalProxyToken } from "./auth.js";
import type { ProxyConfig } from "./config.js";
import { isProxyError, ProxyError } from "./errors.js";
import { buildUpstreamHeaders } from "./headers.js";
import { isLoopbackAddress, normalizeAndValidateRequestTarget } from "./security.js";
import { forwardUpstream, type UpstreamRequestFn } from "./upstream.js";
import { Logger } from "../utils/logger.js";
import type { JsonRecord } from "../utils/result.js";

type ProxyLogger = Pick<Logger, "debug" | "info" | "warn" | "error">;

export interface CreateProxyServerOptions {
  readonly dispatcher?: Dispatcher;
  readonly logger?: ProxyLogger;
  readonly requestImpl?: UpstreamRequestFn;
}

interface HandleProxyRequestOptions {
  readonly config: ProxyConfig;
  readonly dispatcher: Dispatcher;
  readonly logger: ProxyLogger;
  readonly requestImpl: UpstreamRequestFn;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
}

interface PreparedConfluenceProxyRequest {
  readonly method: string;
  readonly normalizedPath: string;
  readonly queryString: string;
  readonly headers: Record<string, string>;
  readonly decisionAccess?: "read" | "write";
  readonly clientAddress: string;
}

export interface ConfluenceProxyRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingMessage["headers"];
  readonly remoteAddress: string;
  readonly body?: Buffer;
}

export interface ConfluenceProxyResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: Buffer;
}

export interface HandleConfluenceProxyRequestOptions {
  readonly config: ProxyConfig;
  readonly dispatcher?: Dispatcher;
  readonly logger: ProxyLogger;
  readonly requestImpl: UpstreamRequestFn;
  readonly request: ConfluenceProxyRequest;
}

export function createConfluenceProxyServer(
  config: ProxyConfig,
  options: CreateProxyServerOptions = {},
): Server {
  const logger = options.logger ?? new Logger(config.logLevel);
  const dispatcher = options.dispatcher ?? buildDispatcher(config);
  const requestImpl = options.requestImpl ?? (request as UpstreamRequestFn);

  return createServer((incomingRequest, serverResponse) => {
    void handleProxyRequest({
      config,
      dispatcher,
      logger,
      requestImpl,
      request: incomingRequest,
      response: serverResponse,
    }).catch((error: unknown) => {
      handleProxyError(error, incomingRequest, serverResponse, logger);
    });
  });
}

export async function startConfluenceProxyServer(
  server: Server,
  config: ProxyConfig,
  logger: ProxyLogger = new Logger(config.logLevel),
): Promise<void> {
  if (config.allowNonLocalBind && !["127.0.0.1", "::1", "localhost"].includes(config.proxyHost)) {
    logger.warn("confluence_proxy_non_local_bind", {
      proxyHost: config.proxyHost,
      warning: "this exposes the proxy beyond the local machine",
    });
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({
      host: config.proxyHost,
      port: config.proxyPort,
    });
  });

  logger.info("confluence_local_auth_proxy_started", {
    proxyHost: config.proxyHost,
    proxyPort: config.proxyPort,
    readOnly: config.proxyReadOnly,
    writeEnabled: config.proxyEnableWrite,
    attachmentsEnabled: config.proxyEnableAttachments,
    localProxyTokenRequired: config.localProxyToken !== undefined,
  });
}

async function handleProxyRequest({
  config,
  dispatcher,
  logger,
  requestImpl,
  request,
  response,
}: HandleProxyRequestOptions): Promise<void> {
  const startedAt = process.hrtime.bigint();
  const method = request.method?.toUpperCase() ?? "GET";
  const rawUrl = request.url ?? "/";
  const preparedRequest = prepareConfluenceProxyRequest(config, {
    method,
    url: rawUrl,
    headers: request.headers,
    remoteAddress: request.socket.remoteAddress ?? "",
  });
  const body = await readRequestBody(request, config.maxRequestBytes);

  const proxyResponse = await forwardPreparedConfluenceProxyRequest({
    config,
    dispatcher,
    logger,
    requestImpl,
    preparedRequest,
    ...(body === undefined ? {} : { body }),
  });

  for (const [name, value] of Object.entries(proxyResponse.headers)) {
    response.setHeader(name, value);
  }

  response.statusCode = proxyResponse.statusCode;
  response.setHeader("content-length", String(proxyResponse.body.byteLength));
  response.end(proxyResponse.body);

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  logger.debug("confluence_proxy_http_response_completed", {
    method,
    path: rawUrl,
    statusCode: proxyResponse.statusCode,
    durationMs: Number(durationMs.toFixed(2)),
  });
}

export async function handleConfluenceProxyRequest({
  config,
  dispatcher,
  logger,
  requestImpl,
  request,
}: HandleConfluenceProxyRequestOptions): Promise<ConfluenceProxyResponse> {
  const preparedRequest = prepareConfluenceProxyRequest(config, request);

  return forwardPreparedConfluenceProxyRequest({
    config,
    logger,
    requestImpl,
    preparedRequest,
    ...(dispatcher === undefined ? {} : { dispatcher }),
    ...(request.body === undefined ? {} : { body: request.body }),
  });
}

function prepareConfluenceProxyRequest(
  config: ProxyConfig,
  request: ConfluenceProxyRequest,
): PreparedConfluenceProxyRequest {
  const method = request.method.toUpperCase();
  const clientAddress = request.remoteAddress;

  if (config.localProxyToken === undefined && !isLoopbackAddress(clientAddress)) {
    throw new ProxyError(403, "LOCALHOST_REQUIRED", "proxy only accepts localhost callers");
  }

  validateLocalProxyToken(request.headers, config.localProxyToken);

  const { normalizedPath, queryString } = normalizeAndValidateRequestTarget(request.url);
  const decision = evaluateRouteAccess(config, method, normalizedPath);

  if (!decision.allowed) {
    throw new ProxyError(
      403,
      decision.reason === "read_only" ? "READ_ONLY_MODE" : "ROUTE_NOT_ALLOWED",
      decision.reason === "read_only"
        ? "write route rejected because CONFLUENCE_PROXY_READ_ONLY=true"
        : "route not allowed by proxy policy",
    );
  }

  return {
    method,
    normalizedPath,
    queryString,
    headers: buildUpstreamHeaders(config, request.headers),
    ...(decision.access === undefined ? {} : { decisionAccess: decision.access }),
    clientAddress,
  };
}

async function forwardPreparedConfluenceProxyRequest({
  config,
  dispatcher,
  logger,
  requestImpl,
  preparedRequest,
  body,
}: {
  readonly config: ProxyConfig;
  readonly dispatcher?: Dispatcher;
  readonly logger: ProxyLogger;
  readonly requestImpl: UpstreamRequestFn;
  readonly preparedRequest: PreparedConfluenceProxyRequest;
  readonly body?: Buffer;
}): Promise<ConfluenceProxyResponse> {
  const startedAt = process.hrtime.bigint();
  const upstreamResponse = await forwardUpstream({
    config,
    requestImpl,
    method: preparedRequest.method,
    normalizedPath: preparedRequest.normalizedPath,
    queryString: preparedRequest.queryString,
    headers: preparedRequest.headers,
    ...(dispatcher === undefined ? {} : { dispatcher }),
    ...(body === undefined ? {} : { body }),
  });

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  logger.info("confluence_proxy_request_completed", {
    method: preparedRequest.method,
    path: preparedRequest.normalizedPath,
    statusCode: upstreamResponse.statusCode,
    durationMs: Number(durationMs.toFixed(2)),
    access: preparedRequest.decisionAccess,
    allowed: true,
    upstreamStatus: upstreamResponse.statusCode,
    tokenProtected: config.localProxyToken !== undefined,
    clientAddress: preparedRequest.clientAddress,
  });

  return upstreamResponse;
}

async function readRequestBody(
  request: IncomingMessage,
  maxRequestBytes: number,
): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk);
    size += buffer.length;

    if (size > maxRequestBytes) {
      throw new ProxyError(
        413,
        "REQUEST_TOO_LARGE",
        `request body exceeded ${maxRequestBytes} bytes`,
      );
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

function handleProxyError(
  error: unknown,
  request: IncomingMessage,
  response: ServerResponse,
  logger: ProxyLogger,
): void {
  const proxyError = isProxyError(error)
    ? error
    : new ProxyError(500, "INTERNAL_ERROR", "internal proxy error", false);

  logger.error("confluence_proxy_request_failed", {
    method: request.method,
    path: request.url,
    statusCode: proxyError.statusCode,
    code: proxyError.code,
    message: proxyError.expose ? proxyError.message : "internal error",
  });

  if (response.headersSent) {
    response.destroy();
    return;
  }

  const body = Buffer.from(
    JSON.stringify({
      error: proxyError.code,
      message: proxyError.expose ? proxyError.message : "internal proxy error",
    }),
  );

  response.statusCode = proxyError.statusCode;
  response.setHeader("content-type", "application/json");
  response.setHeader("content-length", String(body.byteLength));
  response.end(body);
}

function buildDispatcher(config: ProxyConfig): Dispatcher {
  return new Agent({
    connect: {
      rejectUnauthorized: config.strictSsl,
      ...(config.caCert === undefined ? {} : { ca: config.caCert }),
    },
  });
}

export type { ProxyLogger };
