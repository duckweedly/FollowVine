# Quickstart: FollowVine V1

## Prerequisites

- Node.js project dependencies installed.
- Server environment contains a valid image generation API key.
- Docker PostgreSQL is running and reachable through the app database connection string.
- Generated image storage directory is writable by the app.

## Run Locally

1. Install dependencies.
2. Configure the server-only image generation API key and PostgreSQL connection string in local environment variables.
3. Apply database schema setup for page, path, and share metadata.
4. Start the Next.js development server.
4. Open the app in a browser.

## Acceptance Walkthrough

### 1. Generate a recommended demo page

1. Open the start screen.
2. Select the recommended demo topic `RAG 是怎么工作的`.
3. Keep the default `watercolor_book` style.
4. Start generation.
5. Verify a readable 16:9 Chinese illustrated page appears with a clear title and short labels.

### 2. Generate by manual topic entry

1. Return to the start screen or clear the topic field.
2. Enter `Transformer 的注意力机制`.
3. Select `chinese_science_magazine`.
4. Start generation.
5. Verify the generated page uses the selected style.

### 3. Drill down by clicking the image

1. Click a visible object or region in the generated page.
2. Verify a new page appears and clearly explains the clicked area.
3. Repeat until the path has at least three pages.
4. Verify visual style remains consistent across all pages.

### 4. Navigate history without generation

1. Use Back to return to the previous page.
2. Select a previous thumbnail using pointer navigation.
3. Select a previous thumbnail using keyboard navigation.
4. Verify no new page is generated during Back or thumbnail navigation.

### 5. Branch from an earlier page

1. Jump to an earlier page in a multi-page path.
2. Click a different visible region.
3. Verify pages after the selected page are replaced by the new continuation.

### 6. Verify cache reuse

1. Generate the same normalized topic and style again.
2. Verify the previously generated root page is reused.
3. Click the same rounded parent location and style again.
4. Verify the previously generated child page is reused.

### 7. Verify public unlisted sharing

1. Create or open a share link for the current path.
2. Open the link in a new browsing session.
3. Verify the same generated sequence appears without signing in.
4. Restart the app and verify the shared path remains available.

### 8. Verify safety and boundary handling

1. Submit an empty topic.
2. Submit a topic longer than 300 characters.
3. Submit clearly unsafe, illegal, or age-inappropriate test topics.
4. Verify each is rejected before page creation with a prompt to choose a valid knowledge topic.

### 9. Verify credential and prompt protection

1. Inspect browser-visible code, network responses, page metadata, and share data.
2. Verify private generation credentials, prompt templates, local file paths, and client-provided image filenames are not exposed.

## Expected Artifacts

- Generated PNG pages are persisted and served through application-controlled image URLs.
- PostgreSQL page metadata records parent/child relationships and selected style.
- PostgreSQL share metadata records ordered page IDs for public unlisted path viewing.
