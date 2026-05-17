# Claude Code Setup

Install globally:

```bash
npm install -g confluence-legacy-mcp-cli
```

Or use `npx` if you do not want a global install:

```bash
claude mcp add confluence -- npx -y confluence-legacy-mcp-cli
```

If you installed globally, add the server directly:

```bash
claude mcp add confluence -- confluence-legacy-mcp-server
```

Set the required environment variables before launching Claude Code:

```bash
export CONFLUENCE_BASE_URL="https://confluence.example.com/confluence"
export CONFLUENCE_AUTH_MODE="basic"
export CONFLUENCE_USERNAME="your.username"
export CONFLUENCE_PASSWORD="your-password"
export CONFLUENCE_READ_ONLY="true"
export CONFLUENCE_ENABLE_WRITE_TOOLS="false"
```

Optional space policy examples:

```bash
export CONFLUENCE_ALLOWED_SPACES="DEV,OPS"
export CONFLUENCE_DENIED_SPACES="SECRET"
```

Recommended first check inside Claude Code:

```text
Use confluence_list_spaces with limit=5, then tell me whether this Confluence MCP server is read-only or write-enabled.
```

Recommended first content prompts inside Claude Code:

```text
Use confluence_search with cql="type = page order by lastmodified desc", limit=5, and expand=["space","version"].
```

```text
Use confluence_get_page for pageId="123456" and expand=["space","body.storage","version","ancestors"].
```

Keep `CONFLUENCE_READ_ONLY=true` and `CONFLUENCE_ENABLE_WRITE_TOOLS=false` until you explicitly need write access.
