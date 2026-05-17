import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { confluenceApi } from "../confluence/endpoints.js";
import { ensureCqlLength, scopeCql, ensureSpaceAllowed } from "../security/guards.js";
import { normalizePagination } from "../utils/pagination.js";
import { toolSuccess } from "../utils/result.js";
import {
  expandSchema,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  type ToolContext,
} from "./helpers.js";

export function registerSearchTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "confluence_search",
    "Search Confluence content with CQL using Confluence 6.0.x /rest/api/content/search.",
    z.object({
      cql: z.string().trim().min(1),
      expand: expandSchema,
      cqlContext: z.record(z.unknown()).optional(),
      start: paginationSchema.shape.start,
      limit: paginationSchema.shape.limit,
    }),
    readOnlyAnnotations,
    async ({ cql, expand, cqlContext, start, limit }) => {
      if (typeof cqlContext?.spaceKey === "string") {
        ensureSpaceAllowed(context.config, cqlContext.spaceKey);
      }

      ensureCqlLength(cql);
      const effectiveCql = scopeCql(context.config, cql);
      const pagination = normalizePagination({ start, limit }, context.config.maxResults);
      const results = await context.client.searchContent(effectiveCql, {
        expand,
        cqlContext,
        ...pagination,
      });

      return toolSuccess("confluence_search", results, {
        endpoint: confluenceApi("/content/search"),
        effectiveCql,
        compatibility: "Confluence Server 6.0.x CQL content search.",
      });
    },
  );
}
