import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confluenceApi } from "../confluence/endpoints.js";
import type { ConfluenceContent, ConfluencePaginatedResponse } from "../confluence/types.js";
import { ensureBodyLength, ensureWriteAllowed } from "../security/guards.js";
import { normalizePagination } from "../utils/pagination.js";
import { toolSuccess } from "../utils/result.js";
import {
  ensureContentIdAllowed,
  expandSchema,
  pageIdSchema,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  representationSchema,
  safeWriteAnnotations,
  storageBodySchema,
  type ToolContext,
} from "./helpers.js";

export function registerCommentTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "confluence_get_comments",
    "List direct comments for a Confluence page using /rest/api/content/{id}/child/comment.",
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
      const comments = await context.client.get<ConfluencePaginatedResponse<ConfluenceContent>>(
        confluenceApi(`/content/${encodeURIComponent(pageId)}/child/comment`),
        {
          query: {
            expand: expand?.join(","),
            ...pagination,
          },
        },
      );

      return toolSuccess("confluence_get_comments", comments, {
        endpoint: confluenceApi("/content/{id}/child/comment"),
      });
    },
  );

  registerTool(
    server,
    "confluence_add_comment",
    "Add a storage-format comment to a Confluence page. Disabled unless write mode is enabled.",
    z.object({
      pageId: pageIdSchema,
      body: storageBodySchema,
      representation: representationSchema,
    }),
    safeWriteAnnotations,
    async ({ pageId, body }) => {
      ensureWriteAllowed(context.config, "confluence_add_comment");
      await ensureContentIdAllowed(context, pageId);
      ensureBodyLength(body);

      const payload = {
        pageId,
        body,
        representation: "storage",
      };

      if (context.config.dryRun) {
        return toolSuccess("confluence_add_comment", { dryRun: true, payload });
      }

      const comment = await context.client.addComment(pageId, body);
      context.audit.logWrite("confluence_add_comment", pageId);

      return toolSuccess("confluence_add_comment", comment, {
        endpoint: confluenceApi("/content"),
      });
    },
  );
}
