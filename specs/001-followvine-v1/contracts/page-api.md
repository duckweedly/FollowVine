# Contract: Page Generation and Retrieval

## POST /api/page

Creates or reuses a root page or child page.

### Root Page Request

```json
{
  "query": "RAG 是怎么工作的",
  "style": "watercolor_book"
}
```

### Child Page Request

```json
{
  "parentId": "page_id",
  "parentClick": {
    "x": 0.42,
    "y": 0.63
  }
}
```

### Success Response

```json
{
  "page": {
    "id": "page_id",
    "imageUrl": "/generated/page_id.png",
    "parentId": null,
    "parentClick": null,
    "initialQuery": "RAG 是怎么工作的",
    "style": "watercolor_book",
    "createdAt": "2026-05-23T00:00:00.000Z"
  }
}
```

### Contract Rules

- Request must be either a root request or child request, not both.
- Root `query` must be 1-300 characters after normalization.
- Root `query` must not be clearly unsafe, illegal, or age-inappropriate.
- `style` must be one of the launch-visible style keys for root requests.
- Child `parentId` must match the page identifier format and refer to an existing page.
- Child `parentClick.x` and `parentClick.y` must be finite numbers in `[0, 1]`.
- Child page style is inherited from the parent path.
- A cache hit is resolved from PostgreSQL page metadata and returns the existing page with the same response shape.
- A generation failure returns a user-recoverable error and does not change the current path.
- Responses must not include private credentials, prompt templates, or local file paths.

## GET /generated/{pageId}.png

Returns a generated PNG image for a page.

### Contract Rules

- `pageId` must match the page identifier format.
- Image path is derived only from `pageId`.
- Client-provided filenames or paths are ignored.
- Missing image content returns a recoverable not-found response.
