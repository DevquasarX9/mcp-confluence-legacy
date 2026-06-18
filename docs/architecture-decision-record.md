# ADR 0001: External MCP Server for Confluence 6.0.5

## Status

Accepted.

## Context

The project needs to expose Atlassian Confluence Server 6.0.5 content to MCP clients. The required capabilities include searching, reading spaces/pages/blog posts/comments/attachments/labels, and controlled writes for pages, comments, attachments, and labels.

Confluence 6.0.x provides a REST API for these capabilities. The target usage is local or internal company deployment through npm, not Marketplace distribution.

## Decision

Build an external Node.js/TypeScript MCP server that communicates with Confluence through `/rest/api` HTTP endpoints.

The server will:

- Run as a stdio MCP server.
- Use Confluence's authenticated REST API identity.
- Keep read-only mode enabled by default.
- Require explicit opt-in for write tools.
- Validate every tool input with Zod.
- Support a local auth proxy so upstream Confluence credentials can stay out of the MCP server and external MCP client configuration.
- Avoid Confluence P2/OSGi plugin code in the primary architecture.

## Rationale

An external server is simpler to deploy, safer to operate, and easier to version as an npm package. It avoids Confluence plugin lifecycle, OSGi wiring, app signing, Marketplace concerns, and compatibility risk inside an old Confluence 6.0.5 JVM process.

The required content operations are available through REST:

- CQL search
- content get/create/update
- child pages/comments/attachments
- labels
- spaces
- user-aware permission behavior through authenticated API calls

## Consequences

Positive:

- No code runs inside Confluence.
- Clear operational boundary and standard npm release process.
- Easier CI, tests, and MCP client integration.
- Can be deployed per team or per service account.
- Can isolate upstream Basic Auth credentials in `confluence-local-auth-proxy` while the MCP server uses `CONFLUENCE_AUTH_MODE=none`.

Tradeoffs:

- Cannot access plugin-only internals unless exposed by REST.
- Uses Confluence storage XHTML for writes.
- Performance depends on REST pagination and expansions.
- Some authentication modes depend on the organization's proxy/SSO setup.
- Local proxy deployments require an additional local process.

## Optional plugin helper policy

A Confluence-side plugin may be considered only if a required capability is proven impossible through the Confluence 6.0.x REST API. If introduced, it must be optional and narrowly scoped, such as exposing a custom REST endpoint for a company-specific metadata field. The MCP server remains the primary integration point.
