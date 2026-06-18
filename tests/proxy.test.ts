import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { ProxyConfig } from "../src/proxy/config.js";
import { loadProxyConfig } from "../src/proxy/config.js";
import type { ProxyLogger } from "../src/proxy/server.js";
import { handleConfluenceProxyRequest } from "../src/proxy/server.js";
import type { UpstreamRequestFn, UpstreamRequestResponse } from "../src/proxy/upstream.js";

const quietLogger: ProxyLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const baseConfig: ProxyConfig = {
  upstreamBaseUrl: "https://confluence.example.com/confluence",
  upstreamAuthMode: "basic",
  upstreamUsername: "confluence-user",
  upstreamPassword: "confluence-pass",
  proxyHost: "127.0.0.1",
  proxyPort: 4878,
  localProxyToken: "local-secret",
  proxyReadOnly: true,
  proxyEnableWrite: false,
  proxyEnableAttachments: false,
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 1_048_576,
  upstreamTimeoutMs: 30_000,
  strictSsl: true,
  logLevel: "error",
  allowNonLocalBind: false,
};

describe("loadProxyConfig", () => {
  it("loads basic upstream auth with local-only defaults", () => {
    const config = loadProxyConfig({
      CONFLUENCE_UPSTREAM_BASE_URL: "https://confluence.example.com/confluence/",
      CONFLUENCE_UPSTREAM_AUTH_MODE: "basic",
      CONFLUENCE_UPSTREAM_USERNAME: "alice",
      CONFLUENCE_UPSTREAM_PASSWORD: "secret",
    });

    expect(config.upstreamBaseUrl).toBe("https://confluence.example.com/confluence");
    expect(config.proxyHost).toBe("127.0.0.1");
    expect(config.proxyPort).toBe(4878);
    expect(config.proxyReadOnly).toBe(true);
    expect(config.proxyEnableWrite).toBe(false);
  });

  it("rejects non-local bind hosts unless explicitly allowed", () => {
    expect(() =>
      loadProxyConfig({
        CONFLUENCE_UPSTREAM_BASE_URL: "https://confluence.example.com/confluence/",
        CONFLUENCE_UPSTREAM_AUTH_MODE: "basic",
        CONFLUENCE_UPSTREAM_USERNAME: "alice",
        CONFLUENCE_UPSTREAM_PASSWORD: "secret",
        CONFLUENCE_PROXY_HOST: "0.0.0.0",
      }),
    ).toThrow(/non-local host/);
  });
});

describe("Confluence local auth proxy", () => {
  it("rejects requests without the local proxy token", async () => {
    await expect(
      runProxyRequest(baseConfig, failRequest, {
        url: "/rest/api/space",
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "LOCAL_PROXY_AUTH_FAILED",
    });
  });

  it("forwards an allowed read route and injects upstream auth", async () => {
    let upstreamUrl = "";
    let upstreamHeaders: Record<string, string> = {};

    const response = await runProxyRequest(
      baseConfig,
      async (url, options) => {
        upstreamUrl = url;
        upstreamHeaders = options.headers;

        return buildResponse({
          statusCode: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": "JSESSIONID=should-not-return",
          },
          body: Readable.from([Buffer.from(JSON.stringify({ results: [] }))]),
        });
      },
      {
        url: "/rest/api/space?limit=5",
        headers: {
          authorization: "Bearer should-not-pass",
          cookie: "JSESSIONID=should-not-pass",
          "x-confluence-proxy-token": "local-secret",
        },
      },
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body.toString("utf8"))).toEqual({ results: [] });
    expect(upstreamUrl).toBe("https://confluence.example.com/confluence/rest/api/space?limit=5");
    expect(upstreamHeaders.authorization).toBe(
      `Basic ${Buffer.from("confluence-user:confluence-pass").toString("base64")}`,
    );
    expect(upstreamHeaders.cookie).toBeUndefined();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects routes outside the allowlist", async () => {
    await expect(
      runProxyRequest(baseConfig, failRequest, {
        url: "/rest/api/user/password",
        headers: {
          "x-confluence-proxy-token": "local-secret",
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ROUTE_NOT_ALLOWED",
    });
  });

  it("rejects write routes in read-only mode", async () => {
    await expect(
      runProxyRequest(baseConfig, failRequest, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-confluence-proxy-token": "local-secret",
        },
        url: "/rest/api/content",
        body: Buffer.from(JSON.stringify({ type: "page" })),
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ROUTE_NOT_ALLOWED",
    });
  });

  it("allows configured write routes when write mode is enabled", async () => {
    let upstreamBody = "";

    const response = await runProxyRequest(
      {
        ...baseConfig,
        proxyReadOnly: false,
        proxyEnableWrite: true,
      },
      async (_url, options) => {
        upstreamBody = options.body?.toString("utf8") ?? "";

        return buildResponse({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: Readable.from([Buffer.from(JSON.stringify({ id: "123" }))]),
        });
      },
      {
        method: "POST",
        url: "/rest/api/content",
        headers: {
          "content-type": "application/json",
          "x-confluence-proxy-token": "local-secret",
        },
        body: Buffer.from(JSON.stringify({ type: "page" })),
      },
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body.toString("utf8"))).toEqual({ id: "123" });
    expect(JSON.parse(upstreamBody)).toEqual({ type: "page" });
  });

  it("rejects encoded traversal attempts", async () => {
    await expect(
      runProxyRequest(baseConfig, failRequest, {
        url: "/rest/api/content/%2e%2e/space",
        headers: {
          "x-confluence-proxy-token": "local-secret",
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PATH_BYPASS_FORBIDDEN",
    });
  });

  it("enforces upstream response size limits", async () => {
    await expect(
      runProxyRequest(
        {
          ...baseConfig,
          maxResponseBytes: 8,
        },
        async () =>
          buildResponse({
            statusCode: 200,
            headers: { "content-type": "text/plain" },
            body: Readable.from([Buffer.from("too large for limit")]),
          }),
        {
          url: "/rest/api/space",
          headers: {
            "x-confluence-proxy-token": "local-secret",
          },
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "UPSTREAM_RESPONSE_TOO_LARGE",
    });
  });
});

async function runProxyRequest(
  config: ProxyConfig,
  requestImpl: UpstreamRequestFn,
  request: {
    readonly method?: string;
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly body?: Buffer;
  },
): ReturnType<typeof handleConfluenceProxyRequest> {
  return handleConfluenceProxyRequest({
    config,
    logger: quietLogger,
    requestImpl,
    request: {
      method: request.method ?? "GET",
      url: request.url,
      headers: request.headers ?? {},
      remoteAddress: "127.0.0.1",
      ...(request.body === undefined ? {} : { body: request.body }),
    },
  });
}

async function failRequest(): Promise<UpstreamRequestResponse> {
  throw new Error("request should not reach upstream");
}

function buildResponse(response: UpstreamRequestResponse): UpstreamRequestResponse {
  return response;
}
