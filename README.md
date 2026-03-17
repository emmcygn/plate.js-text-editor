# Perry Document Collaboration Tool

A Google Docs-style document collaboration tool for AI-assisted legal document review. Built as a take-home assessment for [Perry](https://useperry.com).

The target document is a **Series A Shareholders' Agreement** (Peec AI GmbH) — 17,464 words, 447 paragraphs, 4 tables, with "the Company" appearing 174 times. This last detail is the spec's explicit disambiguation challenge.

## Quick Start

```bash
pnpm install
pnpm dev        # → http://localhost:5173
```

```bash
pnpm test       # 282 tests (unit + adversarial)
pnpm build      # Production build (includes type-check via tsc -b)
```

## Demo Walkthrough

### Option A: Sample Document (full demo)

1. On the landing page, click **"Load Sample Document"** — the bundled shareholders' agreement loads with full AI review support
2. **Click "Get Perry's Review"** — simulates an AI review pass. After 1.5s, 10 review items appear in the sidebar (5 suggestions with red/green marks in the editor, 5 discussion comments with yellow highlights)
3. **Click a sidebar card** — the editor scrolls to the relevant text and highlights it in yellow. The highlight persists while the card is selected
4. **Accept/Reject suggestions** — accept applies the suggested change; reject restores original text. Both remove the suggestion marks
5. **Resolve comments** — marks discussion threads as resolved
6. **Add your own comments** — select text in the editor, click the floating "Add Comment" button
7. **Toggle suggesting mode** — toolbar toggle switches between direct editing and track-changes mode. Edits in suggesting mode create new suggestion marks

### Option B: Upload Your Own Document

1. **Drag-and-drop any .docx** onto the landing page, or click to browse
2. The document renders with heading hierarchy (standard Word heading styles are mapped automatically)
3. **Manual commenting and suggesting mode** work on any uploaded document
4. AI review is disabled for uploaded documents — the button shows "AI review (sample doc only)" since the review data is anchored to the sample document's specific text

Loading a new document (or switching back to the sample) resets all annotation state cleanly.

### Why Multi-Document Support?

This feature demonstrates **extensibility** — the architecture isn't coupled to a single hardcoded file. It shows that the DOCX import pipeline, editor, annotation store, and sidebar all work as a general-purpose system. The upload UI also demonstrates a realistic user workflow: in production, users would upload their own contracts for review, not rely on a bundled file.

The key architectural signal: swapping documents correctly resets the Zustand store, re-mounts the Plate editor (via React key), and scopes the mock AI review to only the document it was designed for — rather than producing broken anchors on arbitrary content.

### Limitations

- **AI review is sample-only.** The 10 review items are hardcoded with anchors targeting specific text in the shareholders' agreement. Running them against a different document would produce unresolvable anchors. A real integration would call an LLM and generate anchors dynamically.
- **No document persistence.** Uploaded documents are processed in-memory. Refreshing the page returns to the upload screen. A production system would store documents server-side.
- **No multi-document list.** There's no document library or history — it's a single-document-at-a-time workflow. Adding a document list would require backend storage.
- **Standard Word styles only.** The import pipeline maps V14 law firm styles and standard Word `Heading 1`–`Heading 6`. Custom or legacy styles from other templates may render as plain paragraphs.

## Architecture

```
src/
├── editor/
│   ├── plugins/           # Plate plugin configs (highlight, comment-leaf, suggestion-leaf)
│   ├── plate-editor.tsx   # Plate provider + PlateEditorContent with reactive decorations
│   ├── editor-kit.ts      # Plugin assembly — single array
│   └── anchor-navigator.tsx  # Card click → resolve anchor → scroll + highlight
├── components/
│   ├── layout/            # AppShell (2-column), EditorPanel (page chrome), SidebarPanel
│   ├── sidebar/           # SuggestionCard, CommentCard, SidebarHeader, filters
│   ├── toolbar/           # ReviewButton, SuggestingToggle, FloatingCommentButton
│   └── ui/                # shadcn/plate UI primitives
├── lib/
│   ├── annotations/       # Zustand store + suggestion accept/reject/resolve logic
│   ├── anchoring/         # Compound anchoring (THE HARD PROBLEM — see below)
│   ├── mock-review/       # 10 mock AI review items + injection pipeline
│   └── docx-import/       # Mammoth.js → deserializeHtml pipeline with V14 style mapping
├── types/                 # Shared TypeScript types (Anchor, Discussion, ReviewItem)
└── App.tsx                # Entry point — upload UI, document loading, renders editor + sidebar
```

### State Management Split

| Owner | What it manages | Why |
|-------|----------------|-----|
| **Plate.js (Slate)** | Document content, comment marks (`comment_<id>: true`), suggestion marks (`suggestion_<id>: {...}`), paragraph IDs | These are editor-coupled state — marks live on text nodes and participate in the undo/redo history |
| **Zustand** | Sidebar discussions, AI review items, selected card, filter type, highlight range, loading state | UI state that doesn't belong in the editor model — sidebar data, navigation state, filter/sort |

This separation prevents the editor from re-rendering on sidebar interactions and vice versa.

## Tool Evaluation: Why Plate.js

| Framework | Verdict | Key Factor |
|-----------|---------|------------|
| **CKEditor 5 Pro** | Rejected | Solves everything out-of-box but collapses the signal space — reviewer can't see architecture decisions. Also $405/mo paywall. |
| **TipTap Pro** | Rejected | Comments + track changes paywalled ($149+/mo). OSS version has no viable track changes. |
| **TipTap OSS** | Rejected | Building track changes from scratch = months of work. |
| **Lexical** | Rejected | No track changes. No pure decoration system. Ground-up work. |
| **Raw ProseMirror** | Rejected | Maximum control, maximum time. `prosemirror-suggestion-mode` too new/unproven. |
| **Plate.js v52** | **Selected** | Free MIT-licensed. `@platejs/suggestion` provides Google Docs-style track changes. `@platejs/comment` provides inline comments. Rich plugin ecosystem. Enough framework to avoid building from scratch, enough custom work to demonstrate architecture skill. |

### Plate.js Trade-offs

**Pros:** Mature suggestion/comment plugins, Slate foundation with full document model access, active maintenance, good TypeScript support.

**Cons:** Documentation lags behind API changes (v52 broke several patterns from v51 docs). `editor.api.redecorate()` is documented but not functional. `render.aboveLeaf` doesn't exist despite examples showing it. `insertTextSuggestion` generates internal IDs that break external tracking. These required significant debugging (see the "Key Design Decisions" section below for the workarounds).

## The Hard Problem: Anchoring

The spec explicitly challenges: "the Company" appears 174 times — how do you anchor a comment to the right one?

### Compound Anchor Design

```typescript
interface Anchor {
  paragraphId: string;    // Unique ID assigned during DOCX import (nanoid)
  startOffset: number;    // Character offset within paragraph text
  endOffset: number;
  exact: string;          // The selected text
  prefix: string;         // 64 chars before (fingerprint context)
  suffix: string;         // 64 chars after (fingerprint context)
}
```

Modeled on the [Hypothesis annotation platform](https://web.hypothes.is/)'s battle-tested approach (RangeSelector → TextPositionSelector → TextQuoteSelector priority chain).

### Three-Tier Resolution

1. **Tier 1 — Exact ID + Offset:** Find the paragraph by `paragraphId`, extract text at `[startOffset, endOffset]`, verify it matches `exact`. Fast, works when document is unedited.

2. **Tier 2 — Same Paragraph, Fuzzy Match:** If the paragraph exists but offsets are stale (user edited the paragraph), search the paragraph's full text for `exact` using prefix/suffix context scoring. Handles minor edits, insertions, deletions within the same paragraph.

3. **Tier 3 — Full Document Fallback:** If the paragraph was deleted or restructured, scan all blocks in the document. Score each candidate by prefix/suffix context similarity (character overlap ratio). The 64-char context window creates a unique fingerprint that disambiguates even identical text like "the Company".

### Context Scoring

For each candidate occurrence of `exact`, we score how well the surrounding text matches the stored `prefix` and `suffix`:

```
score = (prefixOverlap / prefixLength + suffixOverlap / suffixLength) / 2
```

Where overlap is the longest common character sequence from the boundary. Tier 3 requires at least 1 character of context overlap (score > 0) to accept a match; candidates with zero context similarity are rejected as unresolvable. The highest-scoring candidate wins. This means even if 50 paragraphs contain "the Company", only the one with matching surrounding clause text will be selected.

### Why 64 Characters?

Initial implementation used 32 chars (per Hypothesis). Testing against the actual document revealed that legal boilerplate follows templates — many clauses have identical 32-char prefixes like `"the Company shall notify the "`. Bumping to 64 chars captured enough clause-specific text to achieve reliable disambiguation across all 174 occurrences.

## Key Design Decisions

### Decoration-Based Rendering (not Plugin State)

Comment highlights and click-to-navigate highlights use Plate's `decorate` prop on `PlateContent`, not plugin-internal decoration. This is because:

1. `editor.api.redecorate()` is non-functional in Plate.js v52 (OVERRIDE_MISSING)
2. Plugin decorations don't react to external state changes (Zustand store)
3. By subscribing to Zustand values in the component that renders `PlateContent`, React's re-render cycle creates a new `decorate` function reference, which Plate uses to re-decorate all nodes

This pattern — Zustand subscription → React re-render → new decorate ref → re-decoration — provides reactive decorations without any Plate-internal API.

### Manual Suggestion Mark Injection

The `@platejs/suggestion` plugin's `insertTextSuggestion` API generates its own internal `nanoid()` for each insertion. This breaks the accept/reject lifecycle because the sidebar tracks suggestions by the original review item ID, but the editor nodes have a different ID.

Solution: manually inject suggestion marks using `editor.tf.insertNodes` and `setSuggestionNodes` with explicit IDs matching the review items. This ensures accept/reject can find all related nodes (both deletion marks and insertion marks) by a single ID.

### DOCX Import Pipeline

Mammoth.js converts DOCX → HTML with a custom style mapping for V14 styles (the law firm's template). Plate's `deserializeHtml` converts HTML → Slate AST. A post-processing step assigns sequential IDs (`p{n}_{nanoid}`) to every block-level element — the numeric prefix preserves document order for sidebar sorting, and the nanoid suffix ensures uniqueness.

The pipeline includes three post-processing stages between Mammoth output and Plate deserialization:

1. **TOC cleanup** — strips page numbers and internal anchor links from table-of-contents entries. Page numbers reference Word's paginated layout and are meaningless in a web editor.
2. **List annotation** — adds `data-list-style-type` and `data-indent` attributes to `<li>` elements, bridging Mammoth's standard HTML list output to Plate's indent-based list model.
3. **Table rendering** — custom Plate element components render table nodes as actual `<table>/<tr>/<td>` HTML instead of Plate's default `<div>` wrappers.

The style mapping handles V14 heading variants (Level 1-4 EN, Level 1 EN CAPS), TOC styles, and standard Word `Heading 1`–`Heading 6`. Body-text styles like V14 Introduction EN and V14 Parties EN are intentionally unmapped so Mammoth's default list detection can handle their Word numbering.

#### Known Limitation: Word Auto-Numbering

Word's multi-level numbering engine (section numbers like "1.1", "2.1" and clause markers like "(a)", "(b)") is stored in the DOCX's `word/numbering.xml` as abstract numbering definitions — not as text. Mammoth.js does not reproduce this numbering; it only detects basic `<ol>/<ul>` list structure.

This means headings render without their section numbers ("Employee Incentive Scheme" instead of "1 Employee Incentive Scheme") and sub-clauses render without their letter markers ("amendments to..." instead of "(a) amendments to..."). The content is complete and correct; only the auto-generated numbering prefixes are absent.

This is an accepted trade-off. Mammoth.js was chosen for its semantic extraction — heading hierarchy, paragraph structure, tables, and inline formatting all convert cleanly into Slate's document model, which is what the anchoring and annotation systems need. The numbering gap is cosmetic and doesn't affect functionality.

With more time, I'd approach this differently:
- **Hybrid rendering** — use a library like `docx-preview` for pixel-perfect document display (preserving all Word formatting including numbering), while running Mammoth in parallel to extract the semantic Slate model for anchoring and AI review. The visual layer shows the faithful rendering; the data layer powers the annotation features.
- **Server-side conversion** — a LibreOffice headless service could convert DOCX → HTML/PDF with full numbering fidelity, avoiding the client-side limitation entirely.
- **Numbering XML parser** — parse `word/numbering.xml` directly to extract the abstract numbering definitions, resolve per-level formats, and inject prefixes during import. This is viable but exercises XML parsing rather than editor architecture, so it's a lower-signal investment for a take-home.

## What I'd Improve With More Time

1. **Real AI Integration** — Replace mock setTimeout + hardcoded items with an actual LLM call. The injection pipeline already handles arbitrary review items; only the data source would change.

2. **Collaborative Editing (Yjs)** — The anchoring system would need to switch from absolute paragraph IDs to Yjs relative positions that survive concurrent edits. The three-tier resolution already handles edit recovery; Yjs would make it conflict-free.

3. **E2E Tests (Playwright)** — Specific scenarios:
   - Load document → verify heading structure and table count
   - Trigger review → verify 10 items appear in sidebar
   - Click suggestion card → verify scroll + highlight
   - Accept suggestion → verify text changes and card updates
   - Add comment on selection → verify card appears in sidebar
   - Reject all → verify document restored to original

4. **Error Boundaries** — React error boundaries around the editor and sidebar independently, so a rendering crash in one doesn't take down the other.

5. **Performance** — Virtualize the sidebar for large review sets (100+ items). Currently renders all cards; fine for 10 items, would jank at scale.

6. **Persistence** — Save annotation state to localStorage or a backend. Currently all state is in-memory and lost on refresh.

## Shortcuts Taken

| Shortcut | Why | Impact |
|----------|-----|--------|
| Mock AI data | Spec explicitly says no real AI integration needed | 10 hardcoded items instead of LLM calls |
| No persistence | No backend required per spec | State resets on page refresh |
| No auth | Out of scope per spec | Single hardcoded user ("user-1") |
| AI review sample-only | Mock data targets specific anchors | Upload shows disabled button with explanation |
| No e2e tests | Time constraint; unit + adversarial tests cover logic | Documented as TODO with specific scenarios |
| Single user ID | No multi-user needed | All suggestions/comments attributed to "user-1" |

## Test Suite

282 tests across 12 test files covering:

- **DOCX import** — node structure, heading mapping, paragraph IDs, tables, edge cases (empty paragraphs, duplicate IDs, mammoth warnings)
- **Annotation store** — CRUD operations, filtering, sorting, batch operations, adversarial cases (double accept, non-existent IDs)
- **Sidebar components** — card rendering, click handlers, header counts, filter tabs, empty states, long text truncation
- **Anchoring** — createAnchor, resolveAnchor, fuzzyFind, "the Company" disambiguation (174 occurrences), deleted paragraphs, out-of-bounds offsets, edited text, special characters
- **Mock review injection** — data structure validation, anchor resolution rates (≥8/10), injection safety, double-click guard
- **User interactions** — comment creation, suggesting mode, accept/reject lifecycle, overlapping annotations

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | 5.6 (strict) | Type safety |
| Vite | 6.0 | Build tool + dev server |
| Plate.js | 52.3 | Rich text editor (Slate-based) |
| @platejs/suggestion | 52.0 | Track changes / suggesting mode |
| @platejs/comment | 52.0 | Inline comments as marks |
| @platejs/docx | 52.0 | DOCX paste cleaner |
| Mammoth.js | 1.12 | DOCX → HTML conversion |
| Tailwind CSS | 4.2 | Utility-first CSS |
| Zustand | 5.0 | Sidebar/annotation state |
| Vitest | 4.1 | Unit testing |
| React Testing Library | 16.3 | Component testing |
