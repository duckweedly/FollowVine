# Contract: Public Unlisted Sharing

## GET /share/{shareId}

Shows a public unlisted generated path without requiring sign-in.

### Success Behavior

- Resolves `shareId` through PostgreSQL share metadata to an ordered list of page IDs.
- Shows the same generated sequence in a new browsing session.
- Allows viewing without account ownership or permission checks in V1.
- Preserves generated pages and share paths indefinitely for V1.

### Contract Rules

- `shareId` must be non-guessable and match the share identifier format.
- Anyone with the link can view the path.
- Missing generated content shows a recoverable error instead of a broken page.
- Share data must not expose private credentials, prompt templates, or local file paths.
- Collaborative editing, access control, account ownership, permission management, expiration, and retention controls are out of scope for V1.
