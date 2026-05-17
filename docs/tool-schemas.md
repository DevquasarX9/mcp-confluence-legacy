# MCP Tool Schemas

All tools return:

```json
{
  "ok": true,
  "operation": "tool_name",
  "data": {},
  "meta": {}
}
```

Errors return:

```json
{
  "ok": false,
  "operation": "tool_name",
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe error message",
    "details": {}
  }
}
```

## confluence_search

Input:

```json
{
  "cql": "space = DEV and type = page",
  "expand": ["space", "body.view", "version"],
  "cqlContext": { "spaceKey": "DEV" },
  "start": 0,
  "limit": 25
}
```

Output: Confluence paginated content search response.

Compatibility: uses `GET /rest/api/content/search`.

## confluence_get_page

Input:

```json
{
  "pageId": "123456",
  "expand": ["space", "body.storage", "version", "ancestors"],
  "status": "current"
}
```

Output: Confluence content object.

Compatibility: uses `GET /rest/api/content/{id}`. Works for page content; storage body requires `body.storage`.

## confluence_get_page_children

Input:

```json
{
  "pageId": "123456",
  "expand": ["body.view", "version"],
  "start": 0,
  "limit": 25
}
```

Output: paginated child page collection.

Compatibility: uses `GET /rest/api/content/{id}/child/page`.

## confluence_list_spaces

Input:

```json
{
  "spaceKeys": ["DEV", "OPS"],
  "type": "global",
  "status": "current",
  "label": "docs",
  "expand": ["description.plain", "homepage"],
  "start": 0,
  "limit": 25
}
```

Output: paginated space collection.

Compatibility: uses `GET /rest/api/space`.

## confluence_get_space

Input:

```json
{
  "spaceKey": "DEV",
  "expand": ["description.plain", "homepage"]
}
```

Output: Confluence space object.

Compatibility: uses `GET /rest/api/space/{spaceKey}`.

## confluence_create_page

Input:

```json
{
  "spaceKey": "DEV",
  "title": "Release notes",
  "body": "<p>Release notes body</p>",
  "parentId": "123456",
  "representation": "storage"
}
```

Output: created content object, or dry-run payload.

Compatibility: uses `POST /rest/api/content`. Write mode required.

## confluence_update_page

Input:

```json
{
  "pageId": "123456",
  "title": "Updated title",
  "body": "<p>Updated storage body</p>",
  "versionNumber": 4,
  "minorEdit": true,
  "versionMessage": "Updated by MCP",
  "parentId": "654321",
  "representation": "storage"
}
```

Output: updated content object, or dry-run payload.

Compatibility: uses `PUT /rest/api/content/{id}`. Version number must increment. If omitted, the client reads the current version first.

## confluence_get_comments

Input:

```json
{
  "pageId": "123456",
  "expand": ["body.storage", "version"],
  "start": 0,
  "limit": 25
}
```

Output: paginated child comment collection.

Compatibility: uses `GET /rest/api/content/{id}/child/comment`.

## confluence_add_comment

Input:

```json
{
  "pageId": "123456",
  "body": "<p>Looks good.</p>",
  "representation": "storage"
}
```

Output: created comment object, or dry-run payload.

Compatibility: uses generic content creation with `type=comment`. Write mode required.

## confluence_list_attachments

Input:

```json
{
  "pageId": "123456",
  "filename": "runbook.pdf",
  "mediaType": "application/pdf",
  "expand": ["version", "container"],
  "start": 0,
  "limit": 25
}
```

Output: paginated attachment collection.

Compatibility: uses `GET /rest/api/content/{id}/child/attachment`.

## confluence_upload_attachment

Input:

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

Output: attachment creation response, or dry-run payload.

Compatibility: uses multipart `POST /rest/api/content/{id}/child/attachment` with `X-Atlassian-Token: nocheck`. Write mode required.

## confluence_get_labels

Input:

```json
{
  "contentId": "123456",
  "prefix": "global",
  "start": 0,
  "limit": 25
}
```

Output: paginated labels collection.

Compatibility: uses `GET /rest/api/content/{id}/label`.

## confluence_add_label

Input:

```json
{
  "contentId": "123456",
  "labels": ["docs", { "name": "runbook", "prefix": "global" }]
}
```

Output: label collection after add, or dry-run payload.

Compatibility: uses `POST /rest/api/content/{id}/label`. Write mode required.
