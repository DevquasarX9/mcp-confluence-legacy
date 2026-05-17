import fs from "node:fs/promises";
import { File } from "node:buffer";
import {
  Agent,
  FormData,
  fetch as undiciFetch,
  type BodyInit,
  type Dispatcher,
  type Response,
} from "undici";
import type { AppConfig } from "../config/schema.js";
import { ensureAttachmentAllowed } from "../security/guards.js";
import { Logger } from "../utils/logger.js";
import { buildAuthHeaders } from "./auth.js";
import { confluenceApi } from "./endpoints.js";
import { ConfluenceClientError, normalizeConfluenceErrorMessage } from "./errors.js";
import type { ConfluenceContent, ConfluencePaginatedResponse } from "./types.js";

export type QueryValue = string | number | boolean | readonly string[] | undefined;

export interface ConfluenceRequestOptions {
  readonly query?: Record<string, QueryValue>;
  readonly body?: BodyInit | FormData | object | undefined;
  readonly headers?: Record<string, string>;
  readonly accept?: string;
  readonly contentType?: string;
}

export interface CreatePageOptions {
  readonly spaceKey: string;
  readonly title: string;
  readonly body: string;
  readonly parentId?: string;
  readonly representation?: "storage";
}

export interface UpdatePageOptions {
  readonly pageId: string;
  readonly title?: string;
  readonly body?: string;
  readonly parentId?: string;
  readonly representation?: "storage";
  readonly versionNumber?: number;
  readonly minorEdit?: boolean;
  readonly versionMessage?: string;
}

export interface UploadAttachmentOptions {
  readonly pageId: string;
  readonly filePath: string;
  readonly fileName?: string;
  readonly mediaType?: string;
  readonly comment?: string;
  readonly minorEdit?: boolean;
}

export type FetchImplementation = (
  input: string | URL,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit;
    signal?: AbortSignal;
    dispatcher?: Dispatcher;
  },
) => Promise<Response>;

export class ConfluenceClient {
  private readonly dispatcher: Dispatcher;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly fetchImplementation: FetchImplementation = undiciFetch,
  ) {
    this.dispatcher = new Agent({
      connect: {
        rejectUnauthorized: config.strictSsl,
        ...(config.caCert === undefined ? {} : { ca: config.caCert }),
      },
    });
  }

  public async close(): Promise<void> {
    await this.dispatcher.close();
  }

  public async get<T>(path: string, options?: ConfluenceRequestOptions): Promise<T> {
    return this.requestJson<T>("GET", path, options);
  }

  public async post<T>(path: string, options?: ConfluenceRequestOptions): Promise<T> {
    return this.requestJson<T>("POST", path, options);
  }

  public async put<T>(path: string, options?: ConfluenceRequestOptions): Promise<T> {
    return this.requestJson<T>("PUT", path, options);
  }

  public async searchContent(
    cql: string,
    options: {
      readonly expand?: string[] | undefined;
      readonly cqlContext?: Record<string, unknown> | undefined;
      readonly start?: number | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<ConfluencePaginatedResponse<ConfluenceContent>> {
    return this.get<ConfluencePaginatedResponse<ConfluenceContent>>(confluenceApi("/content/search"), {
      query: {
        cql,
        expand: options.expand?.join(","),
        cqlcontext: options.cqlContext === undefined ? undefined : JSON.stringify(options.cqlContext),
        start: options.start,
        limit: options.limit,
      },
    });
  }

  public async getPage(
    pageId: string,
    options?: {
      readonly expand?: string[] | undefined;
      readonly status?: string | undefined;
      readonly version?: number | undefined;
    },
  ): Promise<ConfluenceContent> {
    return this.get<ConfluenceContent>(confluenceApi(`/content/${encodeURIComponent(pageId)}`), {
      query: {
        expand: options?.expand?.join(","),
        status: options?.status,
        version: options?.version,
      },
    });
  }

  public async createPage(options: CreatePageOptions): Promise<ConfluenceContent> {
    const payload: Record<string, unknown> = {
      type: "page",
      title: options.title,
      space: {
        key: options.spaceKey,
      },
      body: {
        storage: {
          value: options.body,
          representation: options.representation ?? "storage",
        },
      },
    };

    if (options.parentId) {
      payload.ancestors = [{ id: options.parentId }];
    }

    return this.post<ConfluenceContent>(confluenceApi("/content"), {
      body: payload,
    });
  }

  public async updatePage(options: UpdatePageOptions): Promise<ConfluenceContent> {
    const current = await this.getPage(options.pageId, {
      expand: ["space", "version", "ancestors"],
    });
    const nextVersionNumber = options.versionNumber ?? (current.version?.number ?? 0) + 1;

    const payload: Record<string, unknown> = {
      id: options.pageId,
      type: "page",
      title: options.title ?? current.title,
      version: {
        number: nextVersionNumber,
        minorEdit: options.minorEdit ?? false,
        ...(options.versionMessage === undefined ? {} : { message: options.versionMessage }),
      },
    };

    if (options.body !== undefined) {
      payload.body = {
        storage: {
          value: options.body,
          representation: options.representation ?? "storage",
        },
      };
    }

    if (options.parentId) {
      payload.ancestors = [{ id: options.parentId }];
    }

    return this.put<ConfluenceContent>(confluenceApi(`/content/${encodeURIComponent(options.pageId)}`), {
      body: payload,
    });
  }

  public async addComment(pageId: string, body: string): Promise<ConfluenceContent> {
    return this.post<ConfluenceContent>(confluenceApi("/content"), {
      body: {
        type: "comment",
        container: {
          id: pageId,
          type: "page",
        },
        body: {
          storage: {
            value: body,
            representation: "storage",
          },
        },
      },
    });
  }

  public async uploadAttachment<T>(options: UploadAttachmentOptions): Promise<T> {
    const [fileBuffer, fileStats] = await Promise.all([
      fs.readFile(options.filePath),
      fs.stat(options.filePath),
    ]);
    ensureAttachmentAllowed(this.config, fileStats.size);

    const formData = new FormData();
    formData.append(
      "file",
      new File([fileBuffer], options.fileName ?? options.filePath.split("/").pop() ?? "attachment.bin", {
        type: options.mediaType ?? "application/octet-stream",
      }),
    );

    if (options.comment !== undefined) {
      formData.append("comment", options.comment);
    }

    if (options.minorEdit !== undefined) {
      formData.append("minorEdit", String(options.minorEdit));
    }

    return this.post<T>(confluenceApi(`/content/${encodeURIComponent(options.pageId)}/child/attachment`), {
      body: formData,
      headers: {
        "X-Atlassian-Token": "nocheck",
      },
    });
  }

  public async requestJson<T>(
    method: string,
    path: string,
    options?: ConfluenceRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const headers = this.buildHeaders(options);
    const body = this.normalizeRequestBody(options?.body, options?.contentType);

    this.logger.debug("confluence_request", {
      method,
      url: url.toString(),
      accept: options?.accept ?? "application/json",
    });

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const init = {
        method,
        headers,
        signal: controller.signal,
        dispatcher: this.dispatcher,
        ...(body === undefined ? {} : { body }),
      };

      const response = await this.fetchImplementation(url, init);

      const responseText = await this.readResponseText(response);
      const parsedBody = responseText.length > 0 ? this.safeJsonParse(responseText) : null;

      if (!response.ok) {
        throw new ConfluenceClientError(
          "CONFLUENCE_REQUEST_FAILED",
          normalizeConfluenceErrorMessage(
            response.status,
            parsedBody,
            `Confluence request failed with status ${response.status}.`,
          ),
          response.status,
          parsedBody,
        );
      }

      return parsedBody as T;
    } catch (error) {
      if (error instanceof ConfluenceClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ConfluenceClientError(
          "REQUEST_TIMEOUT",
          `Confluence request timed out after ${this.config.timeoutMs}ms.`,
        );
      }

      throw new ConfluenceClientError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Unknown Confluence network error.",
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private buildHeaders(options?: ConfluenceRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: options?.accept ?? "application/json",
      ...(this.isJsonBody(options?.body) ? { "Content-Type": options?.contentType ?? "application/json" } : {}),
      ...(options?.contentType === undefined ? {} : { "Content-Type": options.contentType }),
      ...(buildAuthHeaders(this.config) as Record<string, string>),
      ...(options?.headers ?? {}),
    };

    if (options?.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    return headers;
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): URL {
    const url = new URL(path.startsWith("http") ? path : `${this.config.baseUrl}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
          for (const entry of value) {
            url.searchParams.append(key, entry);
          }
        } else if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url;
  }

  private normalizeRequestBody(
    body: ConfluenceRequestOptions["body"],
    contentType?: string,
  ): BodyInit | undefined {
    if (body === undefined) {
      return undefined;
    }

    if (body instanceof FormData || typeof body === "string" || body instanceof URLSearchParams) {
      return body;
    }

    if (contentType === undefined || contentType === "application/json") {
      return JSON.stringify(body);
    }

    return body as BodyInit;
  }

  private isJsonBody(body: ConfluenceRequestOptions["body"]): boolean {
    return (
      body !== undefined &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams) &&
      typeof body !== "string"
    );
  }

  private async readResponseText(response: Response): Promise<string> {
    const contentLengthHeader = response.headers.get("content-length");
    const declaredLength =
      contentLengthHeader === null ? undefined : Number.parseInt(contentLengthHeader, 10);

    if (declaredLength !== undefined && declaredLength > this.config.maxResponseBytes) {
      throw new ConfluenceClientError(
        "RESPONSE_TOO_LARGE",
        `Confluence response exceeded the configured limit of ${this.config.maxResponseBytes} bytes.`,
      );
    }

    if (!response.body) {
      return "";
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > this.config.maxResponseBytes) {
        throw new ConfluenceClientError(
          "RESPONSE_TOO_LARGE",
          `Confluence response exceeded the configured limit of ${this.config.maxResponseBytes} bytes.`,
        );
      }

      chunks.push(value);
    }

    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  private safeJsonParse(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return { raw: body };
    }
  }
}
