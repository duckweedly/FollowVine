# Feature Specification: FollowVine V1

**Feature Branch**: `001-doc-idea-review`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "看下文档梳理思路"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate an Initial Visual Explainer (Priority: P1)

A learner enters a Chinese knowledge topic, chooses a visual style, and receives a single 16:9 Chinese illustrated explainer page that teaches the topic visually.

**Why this priority**: This is the core value proposition. Without the first generated page, the product cannot validate whether users want to learn through visual flipbooks.

**Independent Test**: Can be fully tested by entering one recommended Chinese demo topic, choosing an available style, and confirming that a readable Chinese visual explainer page appears.

**Acceptance Scenarios**:

1. **Given** the learner is on the start screen, **When** they enter "RAG 是怎么工作的" and choose the default style, **Then** they see one readable 16:9 Chinese illustrated explainer page about RAG.
2. **Given** the learner enters a valid Chinese topic and selects a launch style, **When** generation completes successfully, **Then** the page uses the selected style and presents a clear title with short readable Chinese labels.
3. **Given** the learner enters an empty or overly long topic, **When** they try to generate a page, **Then** they are asked to provide a valid topic before generation starts.

---

### User Story 2 - Drill Into Any Point on the Image (Priority: P1)

A learner clicks any visible position on the current image and receives the next page focused on the clicked region, continuing the same visual explanation path.

**Why this priority**: Click-to-drill-down is the differentiating interaction that separates FollowVine from a static image generator or slide deck.

**Independent Test**: Can be fully tested after any generated page by clicking a visible object or region and confirming that the next page clearly explains that area.

**Acceptance Scenarios**:

1. **Given** the learner is viewing a generated page, **When** they click a visible object or region, **Then** a new 16:9 Chinese illustrated page appears that drills into the clicked area.
2. **Given** the learner clicks the image while a page is already generating, **When** the second click occurs, **Then** the app prevents a duplicate generation request and keeps the current path stable.
3. **Given** the learner continues drilling down for three pages, **When** each page is generated, **Then** the visual style remains consistent across the path.

---

### User Story 3 - Navigate the Explainer Path (Priority: P2)

A learner moves backward or jumps to a previous page thumbnail without generating new content, then can continue drilling from that selected point.

**Why this priority**: Navigation makes the generated path usable as a flipbook rather than a one-way sequence, while still keeping V1 simple.

**Independent Test**: Can be tested after generating at least two pages by using Back and thumbnail navigation and verifying that no new page appears unless the learner clicks the image.

**Acceptance Scenarios**:

1. **Given** the learner has generated multiple pages, **When** they use Back, **Then** the previous page is shown without creating a new page.
2. **Given** the learner selects a previous thumbnail, **When** the selected page is shown, **Then** the visible page changes without creating new content.
3. **Given** the learner jumps to an earlier page and clicks a new area, **When** the next page is generated, **Then** later pages from the old path are replaced by the new continuation.

---

### User Story 4 - Reuse and Share Generated Paths (Priority: P3)

A learner can open a shareable path for an existing generated sequence, and repeated requests for the same topic, style, parent page, and click position reuse the existing page instead of creating a duplicate.

**Why this priority**: Sharing supports product validation and caching controls generation cost, but both depend on the primary generation and drill-down flows.

**Independent Test**: Can be tested by generating a path, opening its share link, and repeating the same topic/style and click-position generation to confirm the same page is reused.

**Acceptance Scenarios**:

1. **Given** a learner has generated a path, **When** they open a share link for that path, **Then** the same generated pages are available for viewing.
2. **Given** the same normalized topic and style were generated before, **When** another learner requests the same starting page, **Then** the existing page is reused.
3. **Given** the same parent page, rounded click location, and style were generated before, **When** the learner clicks the same area again, **Then** the existing child page is reused.

---

### Edge Cases

- If image generation fails, the learner sees a short failure message and can try a different position or topic without losing the current path.
- If the selected style is experimental or unavailable for launch, it is not shown as a normal selectable option.
- If a shared path refers to unavailable generated content, the learner sees a recoverable error instead of a broken page.
- If a click lands on an empty or ambiguous image region, the next page should still explain the nearest meaningful visible context when possible.
- If a topic contains extra spaces or inconsistent casing, it is treated as the same topic for reuse purposes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow learners to enter a Chinese knowledge topic between 1 and 300 characters.
- **FR-002**: The system MUST provide launch style choices for warm watercolor explainer book, Chinese science magazine, and whiteboard marker styles.
- **FR-003**: The system MUST keep the chalkboard style hidden or experimental rather than presenting it as a normal launch style.
- **FR-004**: The system MUST generate one 16:9 Chinese illustrated explainer page for a valid topic and selected style.
- **FR-005**: Generated pages MUST include a clear Chinese title and short readable labels, avoiding dense paragraphs and tiny text.
- **FR-006**: The system MUST allow learners to click any position on the visible generated image to request a deeper follow-up page.
- **FR-007**: Follow-up pages MUST focus on the clicked region or nearest meaningful visual context and continue explaining the same learning path.
- **FR-008**: Follow-up pages MUST preserve the selected style across the full path.
- **FR-009**: The system MUST maintain a linear page path ordered from the initial page through each follow-up page.
- **FR-010**: If a learner branches from an earlier page, the system MUST replace later pages in the previous path with the new continuation.
- **FR-011**: The system MUST let learners go back to previous pages without creating new content.
- **FR-012**: The system MUST let learners jump to previous pages through thumbnails or equivalent history navigation without creating new content.
- **FR-013**: The system MUST prevent duplicate page generation while a generation request is already in progress.
- **FR-014**: The system MUST show a user-friendly generation failure message and preserve the current usable path when generation fails.
- **FR-015**: The system MUST support shareable viewing of generated paths.
- **FR-016**: The system MUST reuse an existing initial page when the same normalized topic and style are requested again.
- **FR-017**: The system MUST reuse an existing follow-up page when the same parent page, rounded click location, and style are requested again.
- **FR-018**: The system MUST ensure learners cannot directly provide or edit the underlying generation prompt.
- **FR-019**: The system MUST ensure private generation credentials are never exposed to learners in the browser experience, page content, or share data.

### Key Entities

- **Page**: A generated 16:9 illustrated explainer page. Key attributes include identifier, image location, selected style, creation time, optional parent page, optional parent click location, and optional initial topic.
- **Explainer Path**: A linear sequence of pages from an initial topic through one or more clicked follow-up pages. It represents the learner's current flipbook journey.
- **Style Preset**: A fixed visual style option available to learners. It determines visual treatment and participates in page reuse identity.
- **Share Link**: A stable reference that allows a generated path to be viewed later or by another learner.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of valid recommended demo topics generate a readable first Chinese explainer page on the first attempt during acceptance testing.
- **SC-002**: Learners can complete the flow from topic entry to viewing the first generated page without additional instruction.
- **SC-003**: In acceptance testing, at least 80% of clicks on visible objects or regions produce a next page that reviewers judge as clearly related to the clicked area.
- **SC-004**: A learner can generate a three-page drill-down path while maintaining a visually consistent style across all pages.
- **SC-005**: Back and thumbnail navigation never create additional generated pages during acceptance testing.
- **SC-006**: Repeating the same topic/style request or the same parent/click/style request returns the previously generated page during acceptance testing.
- **SC-007**: Private generation credentials are not visible in browser-inspectable code, page responses, share data, or generated page metadata.
- **SC-008**: A shared path can be opened in a new browsing session and shows the same generated sequence.

## Assumptions

- V1 targets Chinese knowledge learning and prioritizes Chinese topics and Chinese text in generated pages.
- V1 validates the learning interaction before adding accounts, complex workspaces, semantic hotspots, AI PPT features, whiteboards, or note-taking suites.
- Users can click anywhere on an image; V1 does not require pre-authored fixed hotspots.
- Reuse is defined by normalized topic plus style for initial pages, and by parent page plus rounded click location plus style for follow-up pages.
- Launch sharing is path viewing only; collaborative editing, access control, and account ownership are out of scope for V1.
- Recommended demo topics include RAG, Transformer attention, Agent versus Workflow, OAuth login flow, and Newton's second law.
