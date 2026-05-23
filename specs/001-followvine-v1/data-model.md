# Data Model: FollowVine V1

## PostgreSQL Storage

Page, path, and share metadata are persisted in PostgreSQL. Generated PNG content is stored as local files addressed by page ID.

## Page

Represents one generated 16:9 Chinese illustrated explainer page.

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Deterministic page identifier derived from page inputs and cache version. |
| `imageUrl` | string | yes | Public application URL for the generated PNG, derived from `id`. |
| `parentId` | string \| null | yes | Null for root pages; set to the parent page for child pages. |
| `parentClick` | `{ x: number, y: number }` \| null | yes | Null for root pages; normalized click coordinates rounded to two decimals for child identity. |
| `initialQuery` | string \| null | yes | Normalized learner topic for root pages; null for child pages. |
| `style` | StyleKey | yes | Style selected for the whole path. |
| `createdAt` | ISO datetime string | yes | Creation timestamp. |

### Validation Rules

- `id` must match the system page identifier format.
- `imageUrl` must be derived from `id`; clients must not provide image file names.
- `parentClick.x` and `parentClick.y` must be finite numbers in `[0, 1]` when present.
- `initialQuery` must be 1-300 characters for root pages after normalization.
- Clearly unsafe, illegal, or age-inappropriate topics must not create pages.
- `style` must be a launch-visible style unless explicitly requesting hidden experimental handling.

### Identity Rules

- Root page identity: `root + cache version + normalize(query) + style`.
- Child page identity: `child + cache version + parentId + rounded x/y + style`.
- Repeated identity lookups return existing pages instead of generating duplicates.

## ExplainerPath

Represents one linear learner journey from a root page through zero or more child pages.

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `pages` | Page[] | yes | Ordered from root to current path end. |
| `currentIndex` | number | yes | UI-selected page index. |
| `shareId` | string \| null | no | Stable public unlisted share identifier when a path is shared. |
| `createdAt` | ISO datetime string | yes | Path creation timestamp. |
| `updatedAt` | ISO datetime string | yes | Last path mutation timestamp. |

### State Transitions

1. Start: no pages.
2. Root generation success: `pages = [rootPage]`, `currentIndex = 0`.
3. Child generation from current page: truncate `pages` after `currentIndex`, append child page, set `currentIndex` to the new child.
4. Back or thumbnail navigation: update `currentIndex` only; do not create pages.
5. Share: create or reuse a `ShareLink` for the current ordered page sequence.

## StylePreset

Represents a fixed visual style choice.

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | StyleKey | yes | Stable identifier used in page identity. |
| `displayName` | string | yes | Human-readable style label. |
| `description` | string | yes | Style summary for UI or prompt construction. |
| `isLaunchVisible` | boolean | yes | False for hidden experimental styles. |

### Allowed Values

| Key | Launch Visible | Notes |
|-----|----------------|-------|
| `watercolor_book` | yes | Default style. |
| `chinese_science_magazine` | yes | Launch style. |
| `whiteboard_marker` | yes | Launch style. |
| `chalkboard` | no | Hidden or experimental in V1. |

## ShareLink

Represents a public unlisted stable reference to view an explainer path.

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `shareId` | string | yes | Non-guessable public unlisted identifier. |
| `pageIds` | string[] | yes | Ordered page IDs in the shared path. |
| `createdAt` | ISO datetime string | yes | Creation timestamp. |

### Validation Rules

- Anyone with the link can view the path without signing in.
- Share links and generated pages are retained indefinitely for V1.
- Missing page content must produce a recoverable user-facing error instead of a broken page.

## UI Generation State

Represents transient browser state for the current session.

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `pages` | Page[] | yes | Current linear path. |
| `currentIndex` | number | yes | Index of visible page. |
| `isGenerating` | boolean | yes | Prevents duplicate generation requests. |
| `error` | string \| null | yes | User-facing recoverable error. |

### Rules

- While `isGenerating` is true, additional image clicks do not start duplicate generation.
- Successful generation clears `error`.
- Generation failure preserves the current usable path.
