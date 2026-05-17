# Confluence Legacy MCP Server

[![npm version](https://img.shields.io/npm/v/confluence-legacy-mcp-cli)](https://www.npmjs.com/package/confluence-legacy-mcp-cli)
[![npm downloads](https://img.shields.io/npm/dm/confluence-legacy-mcp-cli)](https://www.npmjs.com/package/confluence-legacy-mcp-cli)
[![CI](https://github.com/DevquasarX9/mcp-confluence-legacy/actions/workflows/ci.yml/badge.svg)](https://github.com/DevquasarX9/mcp-confluence-legacy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >=20.11](https://img.shields.io/badge/node-%3E%3D20.11-brightgreen)](package.json)
[![Confluence Server 6.0.x](https://img.shields.io/badge/Confluence%20Server-6.0.x-blue)](docs/research-summary.md)

External MCP server for Atlassian Confluence Server 6.0.x, built as a Node.js/TypeScript process that talks to Confluence through its legacy-compatible REST API. Search terms: Confluence MCP, MCP Confluence, Confluence Server MCP, legacy Confluence MCP, Atlassian Confluence MCP server.

- npm package: [confluence-legacy-mcp-cli](https://www.npmjs.com/package/confluence-legacy-mcp-cli)
- CLI: `confluence-legacy-mcp-server`
- Repository: [DevquasarX9/mcp-confluence-legacy](https://github.com/DevquasarX9/mcp-confluence-legacy)
- Target: Atlassian Confluence Server 6.0.5
- Works with: Claude Code, Claude Desktop, Codex, Cursor, and other MCP clients
- Project docs: [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), [MIT License](LICENSE), [Release checklist](docs/release-checklist.md)

## Purpose

This project exposes safe, permission-aware Confluence tools to AI clients such as Codex, Claude Desktop, Cursor, and other MCP clients.

It is intentionally an external MCP server, not a Confluence P2/OSGi plugin. It relies on authenticated REST calls to Confluence and lets Confluence enforce space/page/content permissions for the configured identity.

## Compatibility

- Primary target: Confluence Server 6.0.5
- API family: `/rest/api`
- REST compatibility basis: Confluence 6.0.x public REST docs, using the nearest published 6.0.4/6.0.6 references
- Transport: MCP stdio
- Body write format: Confluence `storage` XHTML

Non-goals:

- Confluence Cloud REST v2
- Atlassian Document Format
- Cloud `accountId` assumptions
- Plugin-only Confluence internals
- Destructive page/space deletion tools

## Research Summary

Atlassian's public REST index does not expose a Confluence 6.0.5-specific REST reference. The implementation uses conservative endpoints documented in adjacent 6.0.x REST references.

Key findings:

- REST resources are under `/rest/api`.
- Responses are JSON.
- Expansion uses `expand`, including dot notation such as `body.storage` and `body.view`.
- Pagination uses `start` and `limit`, with server-side caps possible.
- CQL content search is available at `/rest/api/content/search`.
- Page create/update uses `/rest/api/content`.
- Page updates must increment `version.number`.
- Writable page/comment bodies use `storage` representation.
- Attachments use multipart form data and require `X-Atlassian-Token: nocheck`.
- Labels are read and added through `/rest/api/content/{id}/label`.
- Confluence permissions are enforced by the authenticated REST identity.
- Native PATs are not a stock Confluence Server 6.0.5 feature; Atlassian documents Confluence PAT support from Data Center 7.9.

See [docs/research-summary.md](docs/research-summary.md) for the full research notes and links.

## Architecture

```text
MCP client
  |
  | stdio
  v
confluence-legacy-mcp-server
  |
  | HTTPS REST API
  v
Atlassian Confluence Server 6.0.5
```

Main source layout:

```text
src/
  index.ts
  server.ts
  config/
    env.ts
    schema.ts
  confluence/
    auth.ts
    client.ts
    endpoints.ts
    errors.ts
    types.ts
  security/
    audit.ts
    guards.ts
    limits.ts
    redaction.ts
  tools/
    attachments.ts
    comments.ts
    helpers.ts
    index.ts
    labels.ts
    pages.ts
    search.ts
    spaces.ts
  utils/
    logger.ts
    pagination.ts
    result.ts
    validation.ts
tests/
```

The architecture decision record is in [docs/architecture-decision-record.md](docs/architecture-decision-record.md).

## Install

Global install:

```bash
npm install -g confluence-legacy-mcp-cli
```

Run with npx:

```bash
npx -y confluence-legacy-mcp-cli
```

Local development:

```bash
npm install
npm run build
npm test
```

## Configuration

Copy `.env.example` to `.env` for local development, or set the same variables in your MCP client configuration.

Minimal read-only config:

```env
CONFLUENCE_BASE_URL=https://confluence.example.com/confluence
CONFLUENCE_AUTH_MODE=basic
CONFLUENCE_USERNAME=your.username
CONFLUENCE_PASSWORD=your-password
CONFLUENCE_READ_ONLY=true
CONFLUENCE_ENABLE_WRITE_TOOLS=false
```

Optional settings:

```env
CONFLUENCE_STRICT_SSL=true
CONFLUENCE_CA_CERT_PATH=/absolute/path/to/ca.pem
CONFLUENCE_TIMEOUT_MS=30000
CONFLUENCE_MAX_RESULTS=50
CONFLUENCE_MAX_RESPONSE_BYTES=1048576
CONFLUENCE_MAX_ATTACHMENT_BYTES=10485760
CONFLUENCE_LOG_LEVEL=info
CONFLUENCE_AUDIT_LOG=false
CONFLUENCE_DRY_RUN=false
CONFLUENCE_ALLOWED_SPACES=DEV,OPS
CONFLUENCE_DENIED_SPACES=SECRET
```

## Authentication

Supported modes:

- `basic`: username plus password. Recommended for stock Confluence Server 6.0.5 over HTTPS.
- `bearer`: bearer token for reverse-proxy, SSO, or newer/custom deployments. Stock 6.0.5 does not provide native PATs.
- `header`: static trusted proxy header.
- `cookie`: pre-issued cookie value supplied as `CONFLUENCE_COOKIE`.

Basic auth:

```env
CONFLUENCE_AUTH_MODE=basic
CONFLUENCE_USERNAME=alice
CONFLUENCE_PASSWORD=secret
```

Bearer auth:

```env
CONFLUENCE_AUTH_MODE=bearer
CONFLUENCE_TOKEN=token-from-proxy-or-newer-data-center
```

Trusted header:

```env
CONFLUENCE_AUTH_MODE=header
CONFLUENCE_AUTH_HEADER_NAME=X-Forwarded-User
CONFLUENCE_AUTH_HEADER_VALUE=service-account
```

Cookie:

```env
CONFLUENCE_AUTH_MODE=cookie
CONFLUENCE_COOKIE=JSESSIONID=...
```

This server intentionally does not support `os_username` and `os_password` URL query credentials.

## MCP Client Setup

Example client configs live in [`examples/clients/`](examples/clients/):

- [Claude Code guide](examples/clients/claude_code.md)
- [Shared client setup guide](examples/clients/README.md)
- [Claude Desktop JSON config](examples/clients/claude_desktop_config.json)
- [Codex TOML config](examples/clients/codex-config.toml)
- [Cursor MCP JSON config](examples/clients/cursor.mcp.json)

Generic MCP server config:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "confluence-legacy-mcp-server",
      "env": {
        "CONFLUENCE_BASE_URL": "https://confluence.example.com/confluence",
        "CONFLUENCE_AUTH_MODE": "basic",
        "CONFLUENCE_USERNAME": "alice",
        "CONFLUENCE_PASSWORD": "secret",
        "CONFLUENCE_READ_ONLY": "true",
        "CONFLUENCE_ENABLE_WRITE_TOOLS": "false"
      }
    }
  }
}
```

## Available Tools

### `confluence_search`

Search content with CQL.

```json
{
  "cql": "space = DEV and type = page",
  "expand": ["space", "body.view", "version"],
  "start": 0,
  "limit": 25
}
```

### `confluence_get_page`

Get a page by id.

```json
{
  "pageId": "123456",
  "expand": ["space", "body.storage", "version", "ancestors"]
}
```

### `confluence_get_page_children`

List direct child pages.

```json
{
  "pageId": "123456",
  "expand": ["body.view", "version"],
  "start": 0,
  "limit": 25
}
```

### `confluence_list_spaces`

List spaces.

```json
{
  "type": "global",
  "status": "current",
  "expand": ["description.plain", "homepage"],
  "start": 0,
  "limit": 25
}
```

### `confluence_get_space`

Get one space.

```json
{
  "spaceKey": "DEV",
  "expand": ["description.plain", "homepage"]
}
```

### `confluence_create_page`

Create a page. Requires `CONFLUENCE_READ_ONLY=false` and `CONFLUENCE_ENABLE_WRITE_TOOLS=true`.

```json
{
  "spaceKey": "DEV",
  "title": "Runbook",
  "body": "<p>Runbook body</p>",
  "parentId": "123456"
}
```

### `confluence_update_page`

Update a page. Requires write mode.

```json
{
  "pageId": "123456",
  "title": "Updated runbook",
  "body": "<p>Updated body</p>",
  "minorEdit": true,
  "versionMessage": "Updated by MCP"
}
```

### `confluence_get_comments`

List direct page comments.

```json
{
  "pageId": "123456",
  "expand": ["body.storage", "version"],
  "start": 0,
  "limit": 25
}
```

### `confluence_add_comment`

Add a page comment. Requires write mode.

```json
{
  "pageId": "123456",
  "body": "<p>Looks good.</p>"
}
```

### `confluence_list_attachments`

List page attachments.

```json
{
  "pageId": "123456",
  "filename": "runbook.pdf",
  "expand": ["version", "container"],
  "start": 0,
  "limit": 25
}
```

### `confluence_upload_attachment`

Upload an attachment. Requires write mode.

```json
{
  "pageId": "123456",
  "filePath": "/absolute/path/to/file.txt",
  "fileName": "file.txt",
  "comment": "Uploaded by MCP",
  "minorEdit": true,
  "mediaType": "text/plain"
}
```

### `confluence_get_labels`

List content labels.

```json
{
  "contentId": "123456",
  "prefix": "global",
  "start": 0,
  "limit": 25
}
```

### `confluence_add_label`

Add labels to content. Requires write mode.

```json
{
  "contentId": "123456",
  "labels": ["docs", { "name": "runbook", "prefix": "global" }]
}
```

Full schemas are documented in [docs/tool-schemas.md](docs/tool-schemas.md).

## Security Notes

- Credentials must come from environment variables or MCP client configuration.
- Credentials are never hardcoded.
- Logs redact token, password, cookie, secret, and authorization-like fields.
- Read-only mode is enabled by default.
- Write tools require both `CONFLUENCE_READ_ONLY=false` and `CONFLUENCE_ENABLE_WRITE_TOOLS=true`.
- `CONFLUENCE_DRY_RUN=true` returns write payloads without calling write endpoints.
- Request timeout is enforced with `CONFLUENCE_TIMEOUT_MS`.
- Response size is capped with `CONFLUENCE_MAX_RESPONSE_BYTES`.
- Attachment size is capped with `CONFLUENCE_MAX_ATTACHMENT_BYTES`.
- Space allow/deny filters can scope server behavior, but Confluence permissions remain the source of truth.

## Development Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run clean
```

## Build and Package

```bash
npm run clean
npm run build
npm run pack:dry-run
```

The package publishes `dist`, `README.md`, `LICENSE`, `docs`, and `examples`.

## CI/CD

GitHub Actions workflows:

- `.github/workflows/ci.yml`: installs dependencies, typechecks, lints, tests, builds, and verifies package contents on push and pull request.
- `.github/workflows/publish.yml`: publishes to npm when a GitHub release is published.

## npm Publishing

1. Run the release checklist in [docs/release-checklist.md](docs/release-checklist.md).
2. Bump `package.json` version.
3. Create and push a git tag.
4. Publish a GitHub release, or run:

```bash
npm publish --access public
```

## Known Limitations

- Confluence 6.0.5-specific REST docs are not publicly indexed; this project targets documented 6.0.x-compatible endpoints.
- Page/comment writes require storage XHTML.
- No native stock Confluence 6.0.5 PAT support.
- No Cloud v2 APIs.
- No automatic Markdown-to-storage conversion.
- No destructive page, attachment, label, or space deletion tools.
- Inline comments, nested comment creation, restrictions management, watches, and admin operations are not included in the initial tool set.

## References

- [Confluence REST API 6.0.6](https://docs.atlassian.com/atlassian-confluence/REST/6.0.6/)
- [Confluence Server/Data Center REST API overview](https://developer.atlassian.com/server/confluence/confluence-server-rest-api/)
- [Atlassian Personal Access Tokens](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
