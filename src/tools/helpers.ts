import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { AppConfig } from "../config/schema.js";
import { ConfluenceClient } from "../confluence/client.js";
import { ConfluenceClientError } from "../confluence/errors.js";
import type { ConfluenceContent } from "../confluence/types.js";
import { AuditLogger } from "../security/audit.js";
import { GuardError, ensureSpaceAllowed } from "../security/guards.js";
import { Logger } from "../utils/logger.js";
import { asJsonValue, toolError } from "../utils/result.js";

export interface ToolContext {
  readonly config: AppConfig;
  readonly client: ConfluenceClient;
  readonly audit: AuditLogger;
  readonly logger: Logger;
}

export const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: true,
};

export const safeWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  idempotentHint: false,
  destructiveHint: false,
  openWorldHint: true,
};

const idSchema = z.union([z.string().trim().min(1), z.number().int().positive()]);
export const contentIdSchema = idSchema.transform((value) => String(value));
export const pageIdSchema = idSchema.transform((value) => String(value));
export const spaceKeySchema = z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9_.~:-]+$/);
export const expandSchema = z.array(z.string().trim().min(1).max(100)).max(30).optional();
export const storageBodySchema = z.string().min(1);
export const representationSchema = z.literal("storage").optional();
export const paginationSchema = z.object({
  start: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

function normalizeToolError(operation: string, error: unknown): CallToolResult {
  if (error instanceof GuardError) {
    return toolError(operation, error.code, error.message);
  }

  if (error instanceof ConfluenceClientError) {
    return toolError(
      operation,
      error.code,
      error.message,
      error.details === undefined
        ? undefined
        : asJsonValue({ status: error.status ?? null, details: error.details }),
    );
  }

  if (error instanceof z.ZodError) {
    return toolError(operation, "VALIDATION_ERROR", "Input validation failed.", asJsonValue(error.flatten()));
  }

  if (error instanceof Error) {
    return toolError(operation, "INTERNAL_ERROR", error.message);
  }

  return toolError(operation, "INTERNAL_ERROR", "Unknown server error.");
}

export function registerTool<TSchema extends z.ZodTypeAny>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: TSchema | undefined,
  annotations: ToolAnnotations | undefined,
  handler: (arguments_: z.infer<TSchema>) => Promise<CallToolResult>,
): void {
  const effectiveInputSchema = (inputSchema ?? z.object({})) as TSchema;

  (server.registerTool as unknown as (
    toolName: string,
    config: Record<string, unknown>,
    callback: (arguments_: unknown, extra: unknown) => Promise<CallToolResult>,
  ) => void)(
    name,
    {
      description,
      inputSchema: effectiveInputSchema,
      ...(annotations === undefined ? {} : { annotations }),
    },
    async (arguments_, _extra) => {
      try {
        const parsedArguments = effectiveInputSchema.parse(arguments_);
        return await handler(parsedArguments as z.infer<TSchema>);
      } catch (error) {
        return normalizeToolError(name, error);
      }
    },
  );
}

function extractSpaceKey(content: ConfluenceContent): string | undefined {
  if (content.space?.key) {
    return content.space.key;
  }

  const container = content.container;
  if (container && typeof container === "object") {
    const containerSpace = (container as Record<string, unknown>).space;
    if (containerSpace && typeof containerSpace === "object") {
      const key = (containerSpace as Record<string, unknown>).key;
      return typeof key === "string" ? key : undefined;
    }
  }

  return undefined;
}

export function ensureContentSpaceAllowed(config: AppConfig, content: ConfluenceContent): void {
  const spaceKey = extractSpaceKey(content);
  if (spaceKey !== undefined) {
    ensureSpaceAllowed(config, spaceKey);
  }
}

export async function ensureContentIdAllowed(context: ToolContext, contentId: string): Promise<ConfluenceContent> {
  const content = await context.client.getPage(contentId, {
    expand: ["space", "container.space", "version"],
  });
  ensureContentSpaceAllowed(context.config, content);
  return content;
}
