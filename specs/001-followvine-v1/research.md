# Research: FollowVine V1

## Decision: Use a single Next.js monolith for V1

**Rationale**: V1 is validating the click-to-drill visual learning loop. A single app with UI and server route handlers keeps deployment, secrets, local storage, and API contracts small while still separating browser behavior from server-only generation logic.

**Alternatives considered**:
- FastAPI backend plus separate frontend: rejected because it adds deployment and cross-service complexity before the product loop is validated.
- Redis or object storage in V1: rejected because PostgreSQL metadata plus local generated image files are enough for early acceptance testing and avoid extra infrastructure beyond the user's running Docker PostgreSQL.

## Decision: Keep generation prompts, credentials, image file paths, and cache lookup server-side

**Rationale**: The browser must never expose private credentials or prompt construction. Client requests should contain only learner input, style keys, page identifiers, and normalized click coordinates.

**Alternatives considered**:
- Client-side prompt assembly: rejected because it would expose prompt structure and increase prompt injection risk.
- Client-provided image file names or paths: rejected because image paths must be derived from trusted page identifiers.

## Decision: Use deterministic content-addressed page identity

**Rationale**: Reusing generated pages is central to cost control and acceptance criteria. Deterministic IDs make repeated root and child requests resolve to existing pages when their normalized inputs match.

**Alternatives considered**:
- Random page IDs only: rejected because cache hits would require a separate lookup index and make duplicate prevention harder.
- Exact click coordinates: rejected because tiny pointer differences should not create unnecessary duplicate child pages.

## Decision: Persist generated page metadata and share paths in PostgreSQL, with generated PNGs stored locally for V1

**Rationale**: Clarification established indefinite V1 retention, and the user confirmed Docker PostgreSQL is available for database-backed metadata. Planning should avoid expiration logic, deletion workflows, account ownership, or permission management while using PostgreSQL for page, path, and share records.

**Alternatives considered**:
- 30-day expiration: rejected by product clarification.
- Best-effort local-only metadata retention with no promise: rejected because share links are expected to remain available across restarts in V1 acceptance testing.

## Decision: Model an Explainer Path as a linear sequence with branch truncation

**Rationale**: The spec requires Back and thumbnail navigation without generation, and replacing future pages when the learner branches from an earlier page. The UI state and share snapshot should reflect one ordered path.

**Alternatives considered**:
- Tree of branches: rejected because V1 explicitly keeps the path linear and avoids complex exploration history.
- Stateless single-page generation: rejected because sharing, navigation, and branch truncation require sequence metadata.

## Decision: Implement child generation with server-side red-circle reference images

**Rationale**: The source docs define the red-circle trick as the V1 mechanism for interpreting arbitrary image clicks. It lets learners click anywhere without pre-authored hotspots while keeping the browser payload simple.

**Alternatives considered**:
- Fixed hotspot detection: rejected because V1 should support arbitrary clicks.
- Sending click coordinates only to the image model without a marked reference image: rejected because the model needs visual context to understand the click target.

## Decision: Reject clearly unsafe, illegal, or age-inappropriate topics before page creation

**Rationale**: Clarification requires a product-level safety boundary. It also creates testable behavior separate from provider-side image generation failures.

**Alternatives considered**:
- Let the image provider handle all safety: rejected because the product needs a predictable user-facing rejection state.
- Only validate length: rejected because it fails the clarified safety requirement.

## Decision: Provide keyboard access for forms and history, but not arbitrary image-position selection

**Rationale**: Clarification requires keyboard completion for start-screen and history flows while keeping arbitrary image click drill-down pointer/touch based for V1.

**Alternatives considered**:
- Full keyboard-equivalent arbitrary image selection: deferred because it needs an alternate interaction model not required for V1.
- No keyboard requirements: rejected by clarification.
