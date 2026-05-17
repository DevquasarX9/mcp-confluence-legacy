import { describe, expect, it, vi } from "vitest";
import { Response } from "undici";
import type { AppConfig } from "../src/config/schema.js";
import { ConfluenceClient, type FetchImplementation } from "../src/confluence/client.js";
import { ConfluenceClientError } from "../src/confluence/errors.js";
import { Logger } from "../src/utils/logger.js";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    baseUrl: "https://confluence.example.com/confluence",
    authMode: "basic",
    username: "alice",
    password: "secret",
    strictSsl: true,
    timeoutMs: 30_000,
    maxResults: 50,
    maxResponseBytes: 1_048_576,
    maxAttachmentBytes: 10_485_760,
    enableWriteTools: false,
    readOnly: true,
    dryRun: false,
    allowedSpaces: [],
    deniedSpaces: [],
    logLevel: "error",
    auditLog: false,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("ConfluenceClient", () => {
  it("sends basic auth and query parameters", async () => {
    const fetchMock = vi.fn<FetchImplementation>().mockResolvedValue(
      jsonResponse({
        id: "123",
        type: "page",
        title: "Example",
      }),
    );
    const client = new ConfluenceClient(makeConfig(), new Logger("error"), fetchMock);

    await client.getPage("123", {
      expand: ["body.storage", "version"],
    });
    await client.close();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://confluence.example.com/confluence/rest/api/content/123?expand=body.storage%2Cversion",
    );
    expect(init?.headers?.Authorization).toBe(
      `Basic ${Buffer.from("alice:secret").toString("base64")}`,
    );
  });

  it("increments page version when versionNumber is omitted", async () => {
    const fetchMock = vi
      .fn<FetchImplementation>()
      .mockResolvedValueOnce(
        jsonResponse({
          id: "123",
          type: "page",
          title: "Old title",
          version: { number: 3 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "123",
          type: "page",
          title: "New title",
          version: { number: 4 },
        }),
      );
    const client = new ConfluenceClient(makeConfig(), new Logger("error"), fetchMock);

    await client.updatePage({
      pageId: "123",
      title: "New title",
      body: "<p>Updated</p>",
    });
    await client.close();

    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      id: "123",
      type: "page",
      title: "New title",
      version: {
        number: 4,
      },
      body: {
        storage: {
          value: "<p>Updated</p>",
          representation: "storage",
        },
      },
    });
  });

  it("maps Confluence error responses to safe client errors", async () => {
    const fetchMock = vi.fn<FetchImplementation>().mockResolvedValue(
      jsonResponse(
        {
          message: "No content found with id 999",
        },
        404,
      ),
    );
    const client = new ConfluenceClient(makeConfig(), new Logger("error"), fetchMock);

    await expect(client.getPage("999")).rejects.toMatchObject({
      code: "CONFLUENCE_REQUEST_FAILED",
      status: 404,
      message: "No content found with id 999",
    } satisfies Partial<ConfluenceClientError>);
    await client.close();
  });
});
