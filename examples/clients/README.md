# Client Setup

Use the raw config examples in this folder as the source of truth for MCP wiring:

- [Claude Desktop JSON](./claude_desktop_config.json)
- [Codex TOML](./codex-config.toml)
- [Cursor JSON](./cursor.mcp.json)

For Claude Code, use the dedicated guide:

- [Claude Code guide](./claude_code.md)

## Shared Preflight

Before wiring the server into any client, verify the package locally:

```bash
npm run typecheck
npm test
npm run build
```

Then run the server with read-only settings first:

```bash
CONFLUENCE_BASE_URL="https://confluence.example.com/confluence" \
CONFLUENCE_AUTH_MODE="basic" \
CONFLUENCE_USERNAME="your.username" \
CONFLUENCE_PASSWORD="your-password" \
CONFLUENCE_READ_ONLY="true" \
CONFLUENCE_ENABLE_WRITE_TOOLS="false" \
confluence-legacy-mcp-server
```

Optional space policy for any client:

```bash
CONFLUENCE_ALLOWED_SPACES=DEV,OPS
CONFLUENCE_DENIED_SPACES=SECRET
```

## Claude Desktop

Use [claude_desktop_config.json](./claude_desktop_config.json).

Good first requests:

```text
Use confluence_list_spaces with limit=5 and summarize the visible spaces.
```

```text
Use confluence_search with cql="type = page order by lastmodified desc", limit=5, and expand=["space","version"].
```

## Codex

Use [codex-config.toml](./codex-config.toml).

Good first requests:

```text
Use confluence_list_spaces with limit=5 and tell me whether the server appears read-only.
```

```text
Use confluence_get_page for pageId="123456" with expand=["space","body.storage","version"].
```

## Cursor

Use [cursor.mcp.json](./cursor.mcp.json).

Good first requests:

```text
Use confluence_search with cql="space = DEV and type = page", limit=10, and expand=["space","body.view","version"].
```

```text
Use confluence_get_page_children for pageId="123456" with limit=10.
```

## Write Access

Keep write tools disabled until the read-only setup is verified.

To enable safe writes:

```bash
CONFLUENCE_READ_ONLY=false
CONFLUENCE_ENABLE_WRITE_TOOLS=true
```

For a no-mutation write preview:

```bash
CONFLUENCE_DRY_RUN=true
```
