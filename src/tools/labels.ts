import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confluenceApi } from "../confluence/endpoints.js";
import type { ConfluenceLabel, ConfluencePaginatedResponse } from "../confluence/types.js";
import { ensureLabelsAllowed, ensureWriteAllowed } from "../security/guards.js";
import { normalizePagination } from "../utils/pagination.js";
import { toolSuccess } from "../utils/result.js";
import {
  contentIdSchema,
  ensureContentIdAllowed,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  safeWriteAnnotations,
  type ToolContext,
} from "./helpers.js";

const labelNameSchema = z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9_.:-]+$/);
const labelObjectSchema = z.object({
  name: labelNameSchema,
  prefix: z.string().trim().min(1).max(40).optional(),
});
const labelInputSchema = z.union([labelNameSchema, labelObjectSchema]);

function normalizeLabels(labels: Array<z.infer<typeof labelInputSchema>>): ConfluenceLabel[] {
  return labels.map((label) =>
    typeof label === "string"
      ? {
          prefix: "global",
          name: label,
        }
      : {
          prefix: label.prefix ?? "global",
          name: label.name,
        },
  );
}

export function registerLabelTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "confluence_get_labels",
    "List labels on a Confluence content item using /rest/api/content/{id}/label.",
    z.object({
      contentId: contentIdSchema,
      prefix: z.string().trim().min(1).optional(),
      start: paginationSchema.shape.start,
      limit: paginationSchema.shape.limit,
    }),
    readOnlyAnnotations,
    async ({ contentId, prefix, start, limit }) => {
      await ensureContentIdAllowed(context, contentId);
      const pagination = normalizePagination({ start, limit }, context.config.maxResults);
      const labels = await context.client.get<ConfluencePaginatedResponse<ConfluenceLabel>>(
        confluenceApi(`/content/${encodeURIComponent(contentId)}/label`),
        {
          query: {
            prefix,
            ...pagination,
          },
        },
      );

      return toolSuccess("confluence_get_labels", labels, {
        endpoint: confluenceApi("/content/{id}/label"),
      });
    },
  );

  registerTool(
    server,
    "confluence_add_label",
    "Add labels to a Confluence content item. Disabled unless write mode is enabled.",
    z.object({
      contentId: contentIdSchema,
      labels: z.array(labelInputSchema).min(1).max(50),
    }),
    safeWriteAnnotations,
    async ({ contentId, labels }) => {
      ensureWriteAllowed(context.config, "confluence_add_label");
      await ensureContentIdAllowed(context, contentId);
      ensureLabelsAllowed(labels);

      const payload = normalizeLabels(labels);

      if (context.config.dryRun) {
        return toolSuccess("confluence_add_label", { dryRun: true, payload, contentId });
      }

      const result = await context.client.post<ConfluencePaginatedResponse<ConfluenceLabel>>(
        confluenceApi(`/content/${encodeURIComponent(contentId)}/label`),
        {
          body: payload,
        },
      );
      context.audit.logWrite("confluence_add_label", contentId);

      return toolSuccess("confluence_add_label", result, {
        endpoint: confluenceApi("/content/{id}/label"),
      });
    },
  );
}
