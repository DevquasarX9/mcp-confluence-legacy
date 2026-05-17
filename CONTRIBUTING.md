# Contributing

Thanks for helping improve `confluence-legacy-mcp-cli`.

This project targets Atlassian Confluence Server 6.0.x through external REST API calls. Keep the implementation external to Confluence unless a required capability is proven impossible through REST and documented as an optional helper component.

## Development Setup

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Run the package dry run before release-oriented changes:

```bash
npm run pack:dry-run
```

If your local npm cache has permission problems, use a temporary cache:

```bash
npm_config_cache=/private/tmp/npm-cache-confluence-legacy npm run pack:dry-run
```

## Expectations

- Keep `CONFLUENCE_READ_ONLY=true` as the default.
- Guard every write-capable tool with both `CONFLUENCE_READ_ONLY=false` and `CONFLUENCE_ENABLE_WRITE_TOOLS=true`.
- Do not add destructive delete tools without a separate design review and explicit confirmation guard.
- Prefer direct Confluence REST API integration over shell execution, browser scraping, or Confluence plugin code.
- Use Confluence 6.0.x-compatible endpoints and storage-format bodies for writes.
- Validate all tool inputs with Zod.
- Keep credentials out of logs and out of committed files.
- Add or update tests for config parsing, guardrails, error mapping, pagination, and request payload changes.
- Keep `README.md`, `.env.example`, `docs/`, and `examples/clients/` aligned with the actual tool surface.
- Favor searchable documentation: use real MCP tool names, Confluence Server terminology, and clear setup examples.

## Pull Requests

- Keep changes focused.
- Explain whether the change is read-only, write-capable, or security-sensitive.
- Update package metadata when `description`, `keywords`, repository links, CLI names, or compatibility claims become stale.
- Update [docs/research-summary.md](docs/research-summary.md) when new Confluence 6.0.x REST compatibility findings affect implementation.
- Run the full local validation set before asking for review.

Recommended final check:

```bash
npm run typecheck
npm test
npm run build
npm run pack:dry-run
```

## Compatibility Policy

The primary target is Confluence Server 6.0.5. Public Atlassian REST documentation does not expose a dedicated 6.0.5 reference, so this project uses conservative Confluence 6.0.x REST behavior and documents assumptions.

Do not introduce Cloud-only REST v2 behavior, Atlassian Document Format, or `accountId` assumptions into the default tool path.

## Security-Sensitive Changes

Treat authentication, request logging, file uploads, and write-tool gating as security-sensitive. For these changes, include tests and document the behavior in [SECURITY.md](SECURITY.md) or [README.md](README.md) when user action is required.
