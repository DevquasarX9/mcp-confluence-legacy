import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confluenceApi } from "../confluence/endpoints.js";
import type { ConfluenceContent, ConfluencePaginatedResponse } from "../confluence/types.js";
import { ensureWriteAllowed } from "../security/guards.js";
import { normalizePagination } from "../utils/pagination.js";
import { toolSuccess } from "../utils/result.js";
import {
  ensureContentIdAllowed,
  expandSchema,
  pageIdSchema,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  safeWriteAnnotations,
  type ToolContext,
} from "./helpers.js";

export function registerAttachmentTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "confluence_list_attachments",
    "List page attachments using Confluence 6.0.x /rest/api/content/{id}/child/attachment.",
    z.object({
      pageId: pageIdSchema,
      filename: z.string().trim().min(1).optional(),
      mediaType: z.string().trim().min(1).optional(),
      expand: expandSchema,
      start: paginationSchema.shape.start,
      limit: paginationSchema.shape.limit,
    }),
    readOnlyAnnotations,
    async ({ pageId, filename, mediaType, expand, start, limit }) => {
      await ensureContentIdAllowed(context, pageId);
      const pagination = normalizePagination({ start, limit }, context.config.maxResults);
      const attachments = await context.client.get<ConfluencePaginatedResponse<ConfluenceContent>>(
        confluenceApi(`/content/${encodeURIComponent(pageId)}/child/attachment`),
        {
          query: {
            filename,
            mediaType,
            expand: expand?.join(","),
            ...pagination,
          },
        },
      );

      return toolSuccess("confluence_list_attachments", attachments, {
        endpoint: confluenceApi("/content/{id}/child/attachment"),
      });
    },
  );

  registerTool(
    server,
    "confluence_upload_attachment",
    "Upload one attachment to a Confluence page. Disabled unless write mode is enabled.",
    z.object({
      pageId: pageIdSchema,
      filePath: z.string().trim().min(1),
      fileName: z.string().trim().min(1).optional(),
      comment: z.string().trim().max(1000).optional(),
      minorEdit: z.boolean().optional(),
      mediaType: z.string().trim().min(1).optional(),
    }),
    safeWriteAnnotations,
    async ({ pageId, filePath, fileName, comment, minorEdit, mediaType }) => {
      ensureWriteAllowed(context.config, "confluence_upload_attachment");
      await ensureContentIdAllowed(context, pageId);

      const payload = {
        pageId,
        filePath,
        ...(fileName === undefined ? {} : { fileName }),
        ...(comment === undefined ? {} : { comment }),
        ...(minorEdit === undefined ? {} : { minorEdit }),
        ...(mediaType === undefined ? {} : { mediaType }),
      };

      if (context.config.dryRun) {
        return toolSuccess("confluence_upload_attachment", { dryRun: true, payload });
      }

      const attachment = await context.client.uploadAttachment<Record<string, unknown>>(payload);
      context.audit.logWrite("confluence_upload_attachment", pageId);

      return toolSuccess("confluence_upload_attachment", attachment, {
        endpoint: confluenceApi("/content/{id}/child/attachment"),
        compatibility: "Multipart upload requires X-Atlassian-Token: nocheck.",
      });
    },
  );
}
