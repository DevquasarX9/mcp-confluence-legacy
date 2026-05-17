import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAttachmentTools } from "./attachments.js";
import { registerCommentTools } from "./comments.js";
import type { ToolContext } from "./helpers.js";
import { registerLabelTools } from "./labels.js";
import { registerPageTools } from "./pages.js";
import { registerSearchTools } from "./search.js";
import { registerSpaceTools } from "./spaces.js";

export function registerTools(server: McpServer, context: ToolContext): void {
  registerSearchTools(server, context);
  registerPageTools(server, context);
  registerSpaceTools(server, context);
  registerCommentTools(server, context);
  registerAttachmentTools(server, context);
  registerLabelTools(server, context);
}
