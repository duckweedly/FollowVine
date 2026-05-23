# Tasks: FollowVine V1

**Input**: Design documents from `/specs/001-followvine-v1/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the plan and success criteria require unit, route integration, and browser acceptance validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Next.js TypeScript app, PostgreSQL metadata access, test tooling, and runtime generated image storage layout.

- [X] T001 Initialize Next.js TypeScript project metadata, PostgreSQL dependency, and scripts in `package.json`
- [X] T002 Configure TypeScript and Next.js settings in `tsconfig.json` and `next.config.ts`
- [X] T003 [P] Create global app shell and base styles in `app/layout.tsx` and `app/globals.css`
- [X] T004 [P] Configure unit, integration, and browser test runners in `package.json` and `playwright.config.ts`
- [X] T005 [P] Configure local runtime storage ignores and generated image placeholder in `.gitignore` and `storage/generated/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain types, validation, identity, style, and persistence helpers required by all user stories.

**Critical**: No user story work can begin until this phase is complete.

- [X] T006 [P] Define Page, ExplainerPath, StylePreset, ShareLink, and UI generation state types in `lib/types.ts`
- [X] T007 [P] Define launch-visible and hidden style presets in `lib/styles.ts`
- [X] T008 [P] Implement topic normalization and deterministic page ID helpers in `lib/page-ids.ts`
- [X] T009 [P] Implement request validation and unsafe-topic rejection helpers in `lib/validation.ts`
- [X] T010 Implement PostgreSQL metadata access and generated image persistence helpers in `lib/db.ts` and `lib/page-store.ts`
- [X] T011 [P] Add page identity unit tests in `tests/unit/page-ids.test.ts`
- [X] T012 [P] Add request validation and unsafe-topic rejection unit tests in `tests/unit/validation.test.ts`
- [X] T013 [P] Add style preset whitelist unit tests in `tests/unit/styles.test.ts`

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - Generate an Initial Visual Explainer (Priority: P1) MVP

**Goal**: A learner can choose a recommended demo or enter a Chinese topic, choose a launch style, and receive one readable 16:9 Chinese illustrated explainer page.

**Independent Test**: Enter or select `RAG 是怎么工作的`, choose the default style, generate a page, and verify a readable Chinese 16:9 explainer appears; invalid, overlong, and unsafe topics are rejected before page creation.

### Tests for User Story 1

- [X] T014 [P] [US1] Add root page route contract tests in `tests/integration/page-api-root.test.ts`
- [X] T015 [P] [US1] Add start-screen browser acceptance tests for recommended demo and manual topic generation in `tests/e2e/root-generation.spec.ts`

### Implementation for User Story 1

- [X] T016 [P] [US1] Create style picker component in `components/StylePicker.tsx`
- [X] T017 [P] [US1] Create recommended demo and topic entry component in `components/StartScreen.tsx`
- [X] T018 [P] [US1] Create generated page display component in `components/ExplainerViewer.tsx`
- [X] T019 [US1] Implement root image generation prompt and server-only OpenAI wrapper in `lib/image-generation.ts`
- [X] T020 [US1] Implement root page POST handler in `app/api/page/route.ts`
- [X] T021 [US1] Implement generated PNG retrieval route in `app/generated/[...pagePath]/route.ts`
- [X] T022 [US1] Wire start-screen generation state and generated page display in `app/page.tsx`
- [X] T023 [US1] Integrate root validation errors and generation failure messages in `app/page.tsx` and `components/StartScreen.tsx`

**Checkpoint**: User Story 1 works independently as the MVP.

---

## Phase 4: User Story 2 - Drill Into Any Point on the Image (Priority: P1)

**Goal**: A learner can click any visible region on the current generated image and receive a same-style follow-up page focused on that region.

**Independent Test**: Generate a page, click a visible object or region, verify a new page clearly relates to the clicked area, and verify duplicate clicks are blocked while generation is in progress.

### Tests for User Story 2

- [X] T024 [P] [US2] Add child page route contract tests in `tests/integration/page-api-child.test.ts`
- [X] T025 [P] [US2] Add drill-down and duplicate-click browser acceptance tests in `tests/e2e/drill-down.spec.ts`

### Implementation for User Story 2

- [X] T026 [P] [US2] Implement red-circle reference image helper in `lib/red-circle.ts`
- [X] T027 [US2] Extend image generation wrapper for child prompts and marked reference images in `lib/image-generation.ts`
- [X] T028 [US2] Extend page POST handler for child generation requests in `app/api/page/route.ts`
- [X] T029 [US2] Add normalized click coordinate handling and duplicate-click blocking in `components/ExplainerViewer.tsx`
- [X] T030 [US2] Append generated child pages and preserve selected style in `app/page.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Navigate the Explainer Path (Priority: P2)

**Goal**: A learner can use Back or thumbnails to move through the current path without creating new pages, then branch from an earlier page by clicking a new region.

**Independent Test**: Generate at least two pages, use Back and thumbnail navigation, verify no generation request happens, then jump to an earlier page and click a new region to verify later pages are replaced.

### Tests for User Story 3

- [X] T031 [P] [US3] Add history navigation and branch truncation browser tests in `tests/e2e/history-navigation.spec.ts`

### Implementation for User Story 3

- [X] T032 [P] [US3] Create history strip component in `components/HistoryStrip.tsx`
- [X] T033 [US3] Add Back and thumbnail navigation state handling in `app/page.tsx`
- [X] T034 [US3] Implement branch truncation when generating from an earlier page in `app/page.tsx`
- [X] T035 [US3] Add keyboard navigation support for history thumbnails in `components/HistoryStrip.tsx`

**Checkpoint**: User Stories 1, 2, and 3 all work independently.

---

## Phase 6: User Story 4 - Reuse and Share Generated Paths (Priority: P3)

**Goal**: A learner can open a public unlisted share link for an existing path, and repeated root or child generation requests reuse existing pages.

**Independent Test**: Generate a path, open its share link in a new browsing session without signing in, repeat the same root and child requests, and verify existing pages are reused and remain available across restarts.

### Tests for User Story 4

- [X] T036 [P] [US4] Add public unlisted share route integration tests in `tests/integration/share-route.test.ts`
- [X] T037 [P] [US4] Add cache reuse and share browser acceptance tests in `tests/e2e/share-and-cache.spec.ts`

### Implementation for User Story 4

- [X] T038 [P] [US4] Implement public unlisted share persistence using PostgreSQL in `lib/share-store.ts`
- [X] T039 [US4] Add root and child cache-hit behavior in `app/api/page/route.ts` and `lib/page-store.ts`
- [X] T040 [US4] Create share controls component in `components/ShareControls.tsx`
- [X] T041 [US4] Implement public share page in `app/share/[shareId]/page.tsx`
- [X] T042 [US4] Wire share creation and opening into `app/page.tsx` and `components/ShareControls.tsx`
- [X] T043 [US4] Add missing shared content recoverable error handling in `app/share/[shareId]/page.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Security, verification, and acceptance hardening across all stories.

- [X] T044 [P] Add credential, prompt, and local path exposure browser tests in `tests/e2e/security-boundaries.spec.ts`
- [X] T045 [P] Add generated image path traversal tests in `tests/integration/generated-image-route.test.ts`
- [X] T046 [P] Add storage persistence restart coverage in `tests/integration/storage-persistence.test.ts`
- [X] T047 Add full verification script for lint, typecheck, unit, integration, and e2e checks in `package.json`
- [X] T048 Run the quickstart acceptance walkthrough and update deviations in `specs/001-followvine-v1/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational and uses the generated page display from US1.
- **User Story 3 (Phase 5)**: Depends on at least one generated path from US1/US2 for full validation.
- **User Story 4 (Phase 6)**: Depends on page generation and path metadata from US1/US2; can be implemented after Foundational with mocks, but final validation needs prior stories.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: First MVP increment.
- **US2 (P1)**: Completes the core differentiating click-to-drill loop; follows US1 for end-to-end validation.
- **US3 (P2)**: Adds navigation and branch behavior over generated paths.
- **US4 (P3)**: Adds cache reuse and public unlisted sharing.

### Within Each User Story

- Tests before implementation.
- Types and helpers before route handlers.
- Route handlers before UI integration.
- UI components before app-level wiring.
- Each checkpoint must pass before moving to the next priority story.

---

## Parallel Opportunities

- T003, T004, and T005 can run in parallel after T001/T002 are understood.
- T006, T007, T008, T009, T011, T012, and T013 touch separate files and can run in parallel within Foundational work.
- In US1, T014, T015, T016, T017, and T018 can start in parallel after Foundational completion.
- In US2, T024, T025, and T026 can run in parallel before child route integration.
- In US3, T031 and T032 can run in parallel before app-level history wiring.
- In US4, T036, T037, and T038 can run in parallel before app-level share wiring.
- Polish tests T044, T045, and T046 can run in parallel after relevant routes exist.

---

## Parallel Example: User Story 1

```text
Task: "Add root page route contract tests in tests/integration/page-api-root.test.ts"
Task: "Add start-screen browser acceptance tests for recommended demo and manual topic generation in tests/e2e/root-generation.spec.ts"
Task: "Create style picker component in components/StylePicker.tsx"
Task: "Create recommended demo and topic entry component in components/StartScreen.tsx"
Task: "Create generated page display component in components/ExplainerViewer.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Add child page route contract tests in tests/integration/page-api-child.test.ts"
Task: "Add drill-down and duplicate-click browser acceptance tests in tests/e2e/drill-down.spec.ts"
Task: "Implement red-circle reference image helper in lib/red-circle.ts"
```

## Parallel Example: User Story 4

```text
Task: "Add public unlisted share route integration tests in tests/integration/share-route.test.ts"
Task: "Add cache reuse and share browser acceptance tests in tests/e2e/share-and-cache.spec.ts"
Task: "Implement public unlisted share persistence using PostgreSQL in lib/share-store.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate root generation through contract and browser acceptance tests.
5. Stop and demo a single generated Chinese illustrated explainer page.

### Core Loop Next

1. Complete Phase 4: User Story 2.
2. Validate arbitrary image click drill-down and duplicate-click blocking.
3. Demo a three-page same-style drill-down path.

### Incremental Delivery

1. Add User Story 3 for Back, thumbnail navigation, keyboard history navigation, and branch truncation.
2. Add User Story 4 for cache reuse and public unlisted sharing.
3. Complete Phase 7 verification and quickstart walkthrough.

### Team Parallel Strategy

1. Complete Setup and Foundational together.
2. Assign US1 and US2 sequentially for the first core path because US2 needs a generated image display.
3. After US2 contracts are stable, work on US3 navigation and US4 sharing/cache in parallel.
4. Run Polish verification after all selected stories are complete.

---

## Notes

- [P] tasks use different files and have no dependency on incomplete tasks.
- [US1] through [US4] labels map to the user stories in `specs/001-followvine-v1/spec.md`.
- Tests that mock image generation should still verify cache, validation, state, and response contracts.
- Real image generation acceptance should be run only with server-side credentials configured.
- Do not commit generated PNGs or runtime metadata from `storage/`.
