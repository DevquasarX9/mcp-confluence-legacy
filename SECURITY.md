# Security Policy

## Reporting A Vulnerability

Please do not open public issues for security vulnerabilities, leaked credentials, private Confluence content exposure, or authentication bypass concerns.

When reporting, include:

- The affected package version.
- The Confluence deployment type and version, especially whether it is Confluence Server 6.0.5, another 6.0.x version, or Data Center.
- The authentication mode in use: `basic`, `bearer`, `cookie`, or `header`.
- Reproduction steps with sanitized data only.
- Whether write tools were enabled.

Rotate any exposed Confluence, proxy, or npm tokens before reporting.

## Hard Requirements

- Never commit `.env` files or MCP client configs that contain live credentials.
- Never hardcode Confluence credentials, cookies, bearer tokens, proxy headers, or npm tokens.
- Keep `CONFLUENCE_READ_ONLY=true` and `CONFLUENCE_ENABLE_WRITE_TOOLS=false` unless write access is explicitly required.
- Treat Confluence page bodies, comments, labels, filenames, and attachment content as untrusted input.
- Do not log request headers, cookies, tokens, passwords, or raw credential-bearing configuration.
- Do not use `os_username` or `os_password` query parameters; credentials in URLs are too easy to leak.
- Keep request timeout, response size, and attachment size controls active.

## Permission Model

This MCP server does not bypass Confluence permissions. Every REST call runs as the configured Confluence identity. Confluence remains the source of truth for page, space, attachment, comment, and label permissions.

Server-side space allow/deny lists are an additional policy layer, not a replacement for Confluence permissions.

## Write Tool Safety

Write-capable tools require both:

```env
CONFLUENCE_READ_ONLY=false
CONFLUENCE_ENABLE_WRITE_TOOLS=true
```

Use dry-run mode before enabling writes in a new environment:

```env
CONFLUENCE_DRY_RUN=true
```

The initial project intentionally excludes destructive delete tools.

## Supported Versions

Security fixes are expected on the latest published `0.x` release line until the project publishes a stable `1.x` release.
