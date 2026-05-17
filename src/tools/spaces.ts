import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confluenceApi } from "../confluence/endpoints.js";
import type { ConfluencePaginatedResponse, ConfluenceSpace } from "../confluence/types.js";
import { ensureSpaceAllowed, filterAllowedSpaces } from "../security/guards.js";
import { normalizePagination } from "../utils/pagination.js";
import { toolSuccess } from "../utils/result.js";
import {
  expandSchema,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  spaceKeySchema,
  type ToolContext,
} from "./helpers.js";

export function registerSpaceTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "confluence_list_spaces",
    "List Confluence spaces with pagination using Confluence 6.0.x /rest/api/space.",
    z.object({
      spaceKeys: z.array(spaceKeySchema).max(50).optional(),
      type: z.enum(["global", "personal"]).optional(),
      status: z.enum(["current", "archived"]).optional(),
      label: z.string().trim().min(1).optional(),
      expand: expandSchema,
      start: paginationSchema.shape.start,
      limit: paginationSchema.shape.limit,
    }),
    readOnlyAnnotations,
    async ({ spaceKeys, type, status, label, expand, start, limit }) => {
      spaceKeys?.forEach((spaceKey) => ensureSpaceAllowed(context.config, spaceKey));
      const pagination = normalizePagination({ start, limit }, context.config.maxResults);
      const response = await context.client.get<ConfluencePaginatedResponse<ConfluenceSpace>>(
        confluenceApi("/space"),
        {
          query: {
            spaceKey: spaceKeys,
            type,
            status,
            label,
            expand: expand?.join(","),
            ...pagination,
          },
        },
      );

      const filteredResults = filterAllowedSpaces(context.config, response.results);
      const filteredResponse: ConfluencePaginatedResponse<ConfluenceSpace> = {
        ...response,
        results: filteredResults,
        size: filteredResults.length,
      };

      return toolSuccess("confluence_list_spaces", filteredResponse, {
        endpoint: confluenceApi("/space"),
        policyFiltered: filteredResults.length !== response.results.length,
      });
    },
  );

  registerTool(
    server,
    "confluence_get_space",
    "Get one Confluence space by key using Confluence 6.0.x /rest/api/space/{spaceKey}.",
    z.object({
      spaceKey: spaceKeySchema,
      expand: expandSchema,
    }),
    readOnlyAnnotations,
    async ({ spaceKey, expand }) => {
      ensureSpaceAllowed(context.config, spaceKey);
      const space = await context.client.get<Record<string, unknown>>(
        confluenceApi(`/space/${encodeURIComponent(spaceKey)}`),
        {
          query: {
            expand: expand?.join(","),
          },
        },
      );

      return toolSuccess("confluence_get_space", space, {
        endpoint: confluenceApi("/space/{spaceKey}"),
      });
    },
  );
}
