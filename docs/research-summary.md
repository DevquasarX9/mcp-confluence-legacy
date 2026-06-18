# Confluence 6.0.5 REST Compatibility Research

## Scope

This package targets Atlassian Confluence Server 6.0.5 through external HTTP REST calls. Atlassian does not publish a 6.0.5-specific REST reference in the public REST index; the nearest published REST references are 6.0.4 and 6.0.6. The implementation therefore targets the 6.0.x REST surface and uses conservative endpoints that are present in the 6.0.6 reference and documented as applicable to Confluence Server 5.5 through 8.5.

Primary references:

- Atlassian Confluence REST API 6.0.6: https://docs.atlassian.com/atlassian-confluence/REST/6.0.6/
- Atlassian Confluence Server/Data Center REST API overview: https://developer.atlassian.com/server/confluence/confluence-server-rest-api/
- Atlassian PAT documentation: https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html

## REST API shape

- REST resources are under `/rest/api`.
- The API returns JSON and uses standard HTTP methods: `GET`, `POST`, `PUT`, and `DELETE`.
- Confluence supports expansion with the `expand` query parameter. Dot notation is supported, for example `body.view`.
- Most collection endpoints support `start` and `limit` pagination. The server may apply fixed limits.

## Authentication

Confluence REST requests use the same authentication and permission checks as browser access. Anonymous access is possible only where the Confluence instance permits anonymous users. A logged-in user can only see or mutate content that the same user can access in Confluence.

Supported by this MCP server:

- `none`: no outbound auth header. This is intended for local auth proxy deployments where upstream credentials are injected outside the MCP server process.
- `basic`: username plus password. Use only when direct credentials in the MCP server process are acceptable.
- `bearer`: bearer token for reverse-proxy, SSO, or custom/plugin-backed environments. Stock Confluence Server 6.0.5 does not provide native PATs.
- `header`: custom static auth header for trusted internal reverse-proxy deployments.
- `cookie`: pre-issued cookie value from configuration. The server does not scrape login pages or implement browser login.

Not implemented:

- `os_username` / `os_password` query parameters. They put credentials in URLs and logs.
- Native Confluence PAT creation/use for 6.0.5. Atlassian documents Confluence PAT support as available from Confluence Data Center 7.9.

## Search and CQL

Confluence 6.0.x has two relevant search endpoints:

- `/rest/api/content/search`: returns content objects for CQL.
- `/rest/api/search`: returns mixed search results, including content, spaces, and users.

This server uses `/rest/api/content/search` for `confluence_search` because the tool is intended to return safe content records and the results match the content API model. Inputs include `cql`, `cqlContext`, `expand`, `start`, and `limit`.

## Content read/create/update

Relevant endpoints:

- `GET /rest/api/content/{id}` reads a page, blog post, comment, or attachment metadata, depending on content type and expansions.
- `POST /rest/api/content` creates content.
- `PUT /rest/api/content/{contentId}` updates content.

Page bodies should use Confluence storage format:

```json
{
  "body": {
    "storage": {
      "value": "<p>Page body</p>",
      "representation": "storage"
    }
  }
}
```

Updates must increment `version.number`. The MCP tool can accept `versionNumber`; if omitted, the client reads the current page first and sends current version + 1.

Draft update is not supported by the 6.0.x REST resource. This server updates current pages only.

## Children, comments, and descendants

Relevant endpoints:

- `GET /rest/api/content/{id}/child`
- `GET /rest/api/content/{id}/child/{type}`
- `GET /rest/api/content/{id}/descendant/comment`

Direct page children can be fetched through `/child/page`. Comments can be fetched through `/child/comment` for direct comments. The descendants resource documents only comment descendants for non-comment content; this project keeps the initial comment tool simple and uses direct child comments.

Adding a comment uses generic content creation with `type=comment`, a page container, and storage body.

## Attachments

Relevant endpoints:

- `GET /rest/api/content/{id}/child/attachment`
- `POST /rest/api/content/{id}/child/attachment`
- `POST /rest/api/content/{id}/child/attachment/{attachmentId}/data`

Attachment upload is multipart form data. Confluence requires the `X-Atlassian-Token: nocheck` header for multipart attachment operations because of XSRF protection. The form field containing the attachment must be named `file`.

This server supports creating a new attachment on a page. Updating existing attachment binary data can be added later as a separate explicit tool.

## Labels

Relevant endpoints:

- `GET /rest/api/content/{id}/label`
- `POST /rest/api/content/{id}/label`

Adding labels expects a JSON array of label objects such as:

```json
[
  { "prefix": "global", "name": "docs" }
]
```

This server accepts simple label names and optional prefixes, defaulting to `global`.

## Spaces

Relevant endpoints:

- `GET /rest/api/space`
- `GET /rest/api/space/{spaceKey}`
- `GET /rest/api/space/{spaceKey}/content`

The initial server exposes read-only space listing and reads. Space creation/update/delete are deliberately excluded from v1 because the project goal is content-oriented, permission-aware AI access.

## Error behavior

Confluence 6.0.x commonly uses:

- `400` for invalid input, malformed CQL, version conflicts, or bad request bodies.
- `401` for missing or invalid authentication.
- `403` for authenticated users lacking permission.
- `404` both when an object does not exist and when the caller lacks permission to view it.
- `409` for attachment/content version conflicts.

The MCP server maps these to safe tool errors without returning credentials or full request headers.

## Permission behavior

The MCP server does not bypass Confluence permissions. Every operation is executed as the configured authenticated identity. Confluence controls visibility and write access at the space/page/content level. Server-side allow/deny space filters add another layer of policy but do not replace Confluence permissions.

## Known 6.0.5 limitations and assumptions

- Public REST docs omit 6.0.5; implementation is based on adjacent 6.0.x REST documentation.
- No native PAT support in stock Confluence Server 6.0.5.
- No Cloud REST v2, Atlassian Document Format, or accountId behavior.
- Body writes use storage XHTML, not Markdown or ADF.
- The REST API does not expose every UI/admin/plugin capability.
- Some endpoints may be disabled or affected by installed apps, SSO, proxy auth, or admin configuration.
- Plugin-only capabilities are optional future helpers, not part of the core architecture.
