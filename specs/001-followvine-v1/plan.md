# Implementation Plan: FollowVine V1

**Branch**: `001-doc-idea-review` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-followvine-v1/spec.md`

## Summary

FollowVine V1 is a Chinese AI visual flipbook: learners choose or enter a knowledge topic, generate a 16:9 Chinese illustrated explainer page, click any visible position to drill into a follow-up page, navigate a linear path, reuse cached pages, and open public unlisted share links. The implementation uses a single Next.js app with server route handlers for generation, validation, cache lookup, local generated image storage, metadata persistence, and public unlisted sharing.

## Technical Context

**Language/Version**: TypeScript on current stable Node.js supported by Next.js

**Primary Dependencies**: Next.js, React, OpenAI image generation SDK/API client, PostgreSQL client or ORM, Node filesystem utilities for generated image persistence, image processing utility for red-circle reference images

**Storage**: PostgreSQL for page, path, and share metadata; local persistent generated image files for PNG content

**Testing**: Next.js/TypeScript checks, unit tests for normalization/identity/validation, route handler integration tests, browser acceptance tests for core UI flows

**Target Platform**: Web browser client with server-side Next.js runtime

**Project Type**: Single web application with frontend UI and backend route handlers in one repository

**Performance Goals**: Cache hits return without invoking image generation; duplicate clicks are blocked while generation is in progress; Back and thumbnail navigation do not perform generation requests

**Constraints**: API keys and prompts remain server-side; browser sends only topic/style or parent page/click coordinates; generated pages and public unlisted share paths are retained indefinitely for V1; PostgreSQL is available through Docker for metadata; no accounts, access control, object storage, Redis, or separate backend service in V1

**Scale/Scope**: V1 product validation scope with launch demo topics, three visible launch styles, hidden experimental chalkboard style, public unlisted sharing, PostgreSQL metadata persistence, and local generated image persistence suitable for acceptance testing and early usage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file is still a template and does not define enforceable project-specific gates. The plan therefore applies the project instructions and clarified feature constraints as governing gates:

- **Simplicity gate**: Pass. V1 stays a single Next.js application and rejects extra services until the core product loop is validated.
- **Security gate**: Pass. Prompt construction, credentials, file paths, safety validation, and image generation stay server-side.
- **Scope gate**: Pass. Accounts, access control, collaboration, retention controls, semantic hotspots, PPT/whiteboard/note suites, Redis, object storage, and separate backend services are out of scope.
- **Testability gate**: Pass. Requirements are expressible through unit, route integration, and browser acceptance tests.

Post-design re-check: Pass. Phase 1 artifacts preserve the same boundaries and do not introduce unjustified complexity.

## Project Structure

### Documentation (this feature)

```text
specs/001-followvine-v1/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── page-api.md
│   └── share-api.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── page.tsx
├── api/
│   └── page/
│       └── route.ts
├── generated/
│   └── [pageId].png/
│       └── route.ts
└── share/
    └── [shareId]/
        └── page.tsx

components/
├── StartScreen.tsx
├── StylePicker.tsx
├── ExplainerViewer.tsx
├── HistoryStrip.tsx
└── ShareControls.tsx

lib/
├── page-ids.ts
├── styles.ts
├── validation.ts
├── db.ts
├── page-store.ts
├── share-store.ts
├── image-generation.ts
└── red-circle.ts

storage/
└── generated/

tests/
├── unit/
├── integration/
└── e2e/
```

**Structure Decision**: Use one Next.js web application with UI components under `components/`, server-only domain and persistence helpers under `lib/`, route handlers under `app/api`, public generated image retrieval under `app/generated`, and public unlisted share pages under `app/share`. PostgreSQL stores page/path/share metadata; `storage/generated/` stores generated PNG runtime data and is not source code.

## Phase 0: Research Summary

See [research.md](./research.md).

Key decisions:

- Single Next.js monolith for V1.
- Deterministic content-addressed page identity for cache reuse.
- PostgreSQL metadata storage and local generated image files are retained indefinitely for V1.
- Server-side prompt construction, API key use, safety validation, cache lookup, and red-circle reference image generation.
- Public unlisted share links without accounts or permissions.
- Keyboard support for core forms and history navigation, excluding arbitrary image-position selection.

## Phase 1: Design Summary

See [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and [contracts/](./contracts/).

Design outputs:

- Data model covers `Page`, `ExplainerPath`, `StylePreset`, `ShareLink`, and transient UI generation state.
- Page API contract covers root generation, child generation, generated PNG retrieval, validation, cache hits, and safe response boundaries.
- Share contract covers public unlisted path viewing, no sign-in, indefinite V1 retention, and recoverable missing-content handling.
- Quickstart defines browser acceptance walkthroughs for recommended demos, manual topics, drill-down, navigation, branch truncation, cache reuse, public sharing, safety rejection, and credential protection.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
