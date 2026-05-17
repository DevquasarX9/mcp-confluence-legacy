import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confluenceApi } from "../confluence/endpoints.js";
import type { ConfluenceContent, ConfluencePaginatedResponse } from "../confluence/types.js";
import { ensureBodyLength, ensureSpaceAllowed, ensureWriteAllowed } from "../security/guards.js";
import { normalizePagination } from "../utils/pagination.js";
import { toolSuccess } from "../utils/result.js";
import {
  ensureContentIdAllowed,
  ensureContentSpaceAllowed,
  expandSchema,
  pageIdSchema,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  representationSchema,
  safeWriteAnnotations,
  spaceKeySchema,
  storageBodySchema,
  type ToolContext,
} from "./helpers.js";

export function registerPageTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "confluence_get_page",
    "Get a Confluence page by id with optional expansions such as body.storage, body.view, version, and ancestors.",
    z.object({
      pageId: pageIdSchema,
      expand: expandSchema,
      status: z.enum(["current", "trashed", "deleted", "any"]).optional(),
      version: z.number().int().positive().optional(),
    }),
    readOnlyAnnotations,
    async ({ pageId, expand, status, version }) => {
      const page = await context.client.getPage(pageId, {
        expand,
        status,
        version,
      });
      ensureContentSpaceAllowed(context.config, page);

      return toolSuccess("confluence_get_page", page, {
        endpoint: confluenceApi("/content/{id}"),
        compatibility: "Use expand=body.storage to retrieve writable storage XHTML.",
      });
    },
  );

  registerTool(
    server,
    "confluence_get_page_children",
    "List direct child pages for a Confluence page using /rest/api/content/{id}/child/page.",
    z.object({
      pageId: pageIdSchema,
      expand: expandSchema,
      start: paginationSchema.shape.start,
      limit: paginationSchema.shape.limit,
    }),
    readOnlyAnnotations,
    async ({ pageId, expand, start, limit }) => {
      await ensureContentIdAllowed(context, pageId);
      const pagination = normalizePagination({ start, limit }, context.config.maxResults);
      const children = await context.client.get<ConfluencePaginatedResponse<ConfluenceContent>>(
        confluenceApi(`/content/${encodeURIComponent(pageId)}/child/page`),
        {
          query: {
            expand: expand?.join(","),
            ...pagination,
          },
        },
      );

      return toolSuccess("confluence_get_page_children", children, {
        endpoint: confluenceApi("/content/{id}/child/page"),
      });
    },
  );

  registerTool(
    server,
    "confluence_create_page",
    "Create a Confluence page with a storage-format body. Disabled unless write mode is enabled.",
    z.object({
      spaceKey: spaceKeySchema,
      title: z.string().trim().min(1).max(255),
      body: storageBodySchema,
      parentId: pageIdSchema.optional(),
      representation: representationSchema,
    }),
    safeWriteAnnotations,
    async ({ spaceKey, title, body, parentId, representation }) => {
      ensureWriteAllowed(context.config, "confluence_create_page");
      ensureSpaceAllowed(context.config, spaceKey);
      ensureBodyLength(body);

      const payload = {
        spaceKey,
        title,
        body,
        ...(parentId === undefined ? {} : { parentId }),
        representation: representation ?? "storage",
      };

      if (context.config.dryRun) {
        return toolSuccess("confluence_create_page", { dryRun: true, payload });
      }

      const page = await context.client.createPage(payload);
      context.audit.logWrite("confluence_create_page", `${spaceKey}:${page.id}`);

      return toolSuccess("confluence_create_page", page, {
        endpoint: confluenceApi("/content"),
      });
    },
  );

  registerTool(
    server,
    "confluence_update_page",
    "Update a Confluence page with storage-format body and incremented version. Disabled unless write mode is enabled.",
    z
      .object({
        pageId: pageIdSchema,
        title: z.string().trim().min(1).max(255).optional(),
        body: storageBodySchema.optional(),
        parentId: pageIdSchema.optional(),
        representation: representationSchema,
        versionNumber: z.number().int().positive().optional(),
        minorEdit: z.boolean().optional(),
        versionMessage: z.string().trim().max(255).optional(),
      })
      .refine(
        (value) => value.title !== undefined || value.body !== undefined || value.parentId !== undefined,
        "Provide at least one of title, body, or parentId.",
      ),
    safeWriteAnnotations,
    async ({ pageId, title, body, parentId, representation, versionNumber, minorEdit, versionMessage }) => {
      ensureWriteAllowed(context.config, "confluence_update_page");
      await ensureContentIdAllowed(context, pageId);

      if (body !== undefined) {
        ensureBodyLength(body);
      }

      const payload = {
        pageId,
        ...(title === undefined ? {} : { title }),
        ...(body === undefined ? {} : { body }),
        ...(parentId === undefined ? {} : { parentId }),
        representation: representation ?? "storage",
        ...(versionNumber === undefined ? {} : { versionNumber }),
        ...(minorEdit === undefined ? {} : { minorEdit }),
        ...(versionMessage === undefined ? {} : { versionMessage }),
      };

      if (context.config.dryRun) {
        return toolSuccess("confluence_update_page", { dryRun: true, payload });
      }

      const page = await context.client.updatePage(payload);
      context.audit.logWrite("confluence_update_page", pageId);

      return toolSuccess("confluence_update_page", page, {
        endpoint: confluenceApi("/content/{id}"),
      });
    },
  );
}
