import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import mammoth from 'mammoth';
import { createSlateEditor, deserializeHtml } from 'platejs';
import type { SlateEditor, BaseRange } from 'platejs';
import type { Annotation, ReviewItem } from '@/types/annotations';
import { assignNodeIds } from '@/lib/docx-import';
import { resolveAnchor } from '@/lib/anchoring';
import { useAnnotationStore } from '@/lib/annotations/store';
import { injectReviewItems } from '../inject-review';
import {
  REVIEW_SUGGESTIONS,
  REVIEW_DISCUSSIONS,
} from '../review-items';

const ALL_ITEMS: Annotation[] = [...REVIEW_SUGGESTIONS, ...REVIEW_DISCUSSIONS];
const DOCX_PATH = 'public/document.docx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDocumentText(): Promise<string> {
  const buf = fs.readFileSync(DOCX_PATH);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value;
}

async function createRealEditor(): Promise<SlateEditor> {
  const buf = fs.readFileSync(DOCX_PATH);
  // Use mammoth directly with { buffer } to avoid ArrayBuffer polyfill issues in jsdom
  const result = await mammoth.convertToHtml({ buffer: buf });
  const editor = createSlateEditor({});
  const nodes = deserializeHtml(editor, { element: result.value });
  editor.children = assignNodeIds(nodes);
  return editor;
}

function resetStore(): void {
  useAnnotationStore.setState({
    discussions: [],
    reviewItems: [],
    selectedCardId: null,
    filterType: 'all',
    isReviewLoading: false,
    highlightRange: null,
    highlightPhase: null,
  });
}

// ---------------------------------------------------------------------------
// DATA INTEGRITY ATTACKS
// ---------------------------------------------------------------------------

describe('Adversarial: Data integrity attacks', () => {
  let docText: string;

  beforeEach(async () => {
    docText = await loadDocumentText();
    resetStore();
  });

  it('1. All anchor.exact strings exist in the actual document', () => {
    for (const item of ALL_ITEMS) {
      const { exact } = item.anchor;
      const found = docText.includes(exact);
      expect(
        found,
        `anchor.exact "${exact}" (item ${item.id}) not found in document text`,
      ).toBe(true);
    }
  });

  it('2. All prefix/suffix context matches around exact text', () => {
    for (const item of ALL_ITEMS) {
      const { exact, prefix, suffix } = item.anchor;

      // Find all occurrences of exact in the document
      const indices: number[] = [];
      let from = 0;
      while (from <= docText.length - exact.length) {
        const idx = docText.indexOf(exact, from);
        if (idx === -1) break;
        indices.push(idx);
        from = idx + 1;
      }

      expect(
        indices.length,
        `"${exact}" (${item.id}) must appear at least once in the document`,
      ).toBeGreaterThan(0);

      // At least one occurrence must have matching prefix and suffix context.
      // Check that at least 15 chars of the prefix appear immediately before.
      const prefixTail = prefix.slice(-15).replace(/\s+/g, ' ').trim();
      const suffixHead = suffix.slice(0, 15).replace(/\s+/g, ' ').trim();

      const hasMatchingContext = indices.some((idx) => {
        const beforeText = docText
          .slice(Math.max(0, idx - prefix.length - 10), idx)
          .replace(/\s+/g, ' ');
        const afterText = docText
          .slice(idx + exact.length, idx + exact.length + suffix.length + 10)
          .replace(/\s+/g, ' ');

        const prefixMatch = prefixTail.length === 0 || beforeText.includes(prefixTail);
        const suffixMatch = suffixHead.length === 0 || afterText.includes(suffixHead);
        return prefixMatch && suffixMatch;
      });

      expect(
        hasMatchingContext,
        `No occurrence of "${exact}" (${item.id}) has matching prefix/suffix context. ` +
          `Wanted prefix tail: "${prefixTail}", suffix head: "${suffixHead}"`,
      ).toBe(true);
    }
  });

  it('3. No two anchors resolve to the same location (no overlapping ranges)', async () => {
    const editor = await createRealEditor();

    const resolved: Array<{ id: string; range: BaseRange }> = [];
    for (const item of ALL_ITEMS) {
      const range = resolveAnchor(editor, item.anchor);
      if (range) {
        resolved.push({ id: item.id, range });
      }
    }

    // Compare all pairs for overlap
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i];
        const b = resolved[j];

        // Two ranges overlap if they share the same anchor path AND offset ranges intersect
        const aAnchor = a.range.anchor;
        const bAnchor = b.range.anchor;
        const aFocus = a.range.focus;
        const bFocus = b.range.focus;

        const samePath =
          JSON.stringify(aAnchor.path) === JSON.stringify(bAnchor.path) &&
          JSON.stringify(aFocus.path) === JSON.stringify(bFocus.path);

        if (samePath) {
          const aStart = Math.min(aAnchor.offset, aFocus.offset);
          const aEnd = Math.max(aAnchor.offset, aFocus.offset);
          const bStart = Math.min(bAnchor.offset, bFocus.offset);
          const bEnd = Math.max(bAnchor.offset, bFocus.offset);

          const overlaps = aStart < bEnd && bStart < aEnd;
          expect(
            overlaps,
            `Ranges for ${a.id} [${aStart},${aEnd}] and ${b.id} [${bStart},${bEnd}] overlap on same path`,
          ).toBe(false);
        }
      }
    }
  });

  it('4. At least 8 of 10 anchors resolve against the real document', async () => {
    const editor = await createRealEditor();
    let resolved = 0;
    const failed: string[] = [];

    for (const item of ALL_ITEMS) {
      const range = resolveAnchor(editor, item.anchor);
      if (range) {
        resolved++;
      } else {
        failed.push(item.id);
      }
    }

    expect(
      resolved,
      `Only ${resolved}/10 anchors resolved. Failed: ${failed.join(', ')}`,
    ).toBeGreaterThanOrEqual(8);
  });

  it('5. Resolution is deterministic — same results on repeated runs', async () => {
    const editor = await createRealEditor();

    const run = () =>
      ALL_ITEMS.map((item) => {
        const range = resolveAnchor(editor, item.anchor);
        return { id: item.id, range: range ? JSON.stringify(range) : null };
      });

    const first = run();
    const second = run();

    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// STORE CORRUPTION ATTACKS
// ---------------------------------------------------------------------------

describe('Adversarial: Store corruption attacks', () => {
  beforeEach(() => {
    resetStore();
  });

  it('6. Concurrent injection does not corrupt state (no duplicates)', async () => {
    const editor = await createRealEditor();

    // Call injectReviewItems twice rapidly (synchronous — single-threaded JS)
    const result1 = injectReviewItems(editor);
    injectReviewItems(editor);

    const state = useAnnotationStore.getState();
    const reviewIds = state.reviewItems.map((r) => r.id);
    const discussionIds = state.discussions.map((d) => d.id);

    // Review items dedup via addBatchReviewItems
    expect(new Set(reviewIds).size).toBe(reviewIds.length);
    expect(state.reviewItems.length).toBe(result1.injectedSuggestions);

    // Discussions dedup via ID check in injectReviewItems
    expect(new Set(discussionIds).size).toBe(discussionIds.length);
    expect(state.discussions.length).toBe(result1.injectedDiscussions);
  });

  it('7. Injection after store has existing items — no overwrites', async () => {
    const editor = await createRealEditor();

    // Pre-populate with 5 fake items
    const preExisting: ReviewItem[] = Array.from({ length: 5 }, (_, i) => ({
      type: 'reviewItem' as const,
      id: `pre-existing-${i}`,
      anchor: {
        paragraphId: 'fake-p',
        startOffset: 0,
        endOffset: 5,
        exact: 'fake',
        prefix: 'pre-',
        suffix: '-suf',
      },
      author: 'user' as const,
      action: 'replace' as const,
      originalText: 'fake',
      suggestedText: 'replaced',
      rationale: 'test rationale that is long enough to pass validation',
      severity: 'minor' as const,
      clause: 'Section 99',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }));

    const store = useAnnotationStore.getState();
    store.addBatchReviewItems(preExisting);

    const result = injectReviewItems(editor);

    const state = useAnnotationStore.getState();

    // All 5 pre-existing items should still be there
    for (const item of preExisting) {
      const found = state.reviewItems.find((r) => r.id === item.id);
      expect(found, `Pre-existing item ${item.id} was overwritten`).toBeDefined();
    }

    // Total = pre-existing + newly injected
    expect(state.reviewItems.length).toBe(5 + result.injectedSuggestions);
  });

  it('8. Store state is clean after loading toggle', () => {
    const store = useAnnotationStore.getState();

    // Set some state first
    store.setFilterType('suggestion');
    store.setSelectedCard('some-id');

    // Toggle loading
    store.setReviewLoading(true);
    store.setReviewLoading(false);

    const state = useAnnotationStore.getState();

    // Loading toggle should not affect other fields
    expect(state.isReviewLoading).toBe(false);
    expect(state.filterType).toBe('suggestion');
    expect(state.selectedCardId).toBe('some-id');
    expect(state.discussions).toEqual([]);
    expect(state.reviewItems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EDGE CASE ANCHORS
// ---------------------------------------------------------------------------

describe('Adversarial: Edge case anchors', () => {
  beforeEach(() => {
    resetStore();
  });

  it('9. Anchors with special characters resolve correctly', async () => {
    const editor = await createRealEditor();

    // Check which items contain special characters (parens, slashes, German chars)
    const specialCharItems = ALL_ITEMS.filter((item) => {
      const combined =
        item.anchor.exact + item.anchor.prefix + item.anchor.suffix;
      return /[()/äöüßÄÖÜ]/.test(combined);
    });

    // The document is a German legal agreement, so there should be some
    // If none of the mock anchors have special chars, test with the document itself
    for (const item of specialCharItems) {
      const range = resolveAnchor(editor, item.anchor);
      expect(
        range,
        `Anchor with special chars failed to resolve: ${item.id} (exact: "${item.anchor.exact}")`,
      ).not.toBeNull();
    }

    // Also verify general resolution doesn't break with parentheses in anchors
    // (e.g., "six (6) months" has parentheses)
    const parenItem = ALL_ITEMS.find((item) =>
      item.anchor.exact.includes('('),
    );
    if (parenItem) {
      const range = resolveAnchor(editor, parenItem.anchor);
      expect(
        range,
        `Anchor with parentheses failed: "${parenItem.anchor.exact}"`,
      ).not.toBeNull();
    }
  });

  it('10. Empty editor does not crash injection', () => {
    const editor = createSlateEditor({});
    editor.children = [];

    const result = injectReviewItems(editor);

    // All items should be skipped, no crash
    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
    expect(result.skippedIds.length).toBe(ALL_ITEMS.length);
  });

  it('11. Editor with single empty paragraph does not crash injection', () => {
    const editor = createSlateEditor({});
    editor.children = [
      { type: 'p', id: 'p-1', children: [{ text: '' }] } as never,
    ];

    const result = injectReviewItems(editor);

    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
    expect(result.skippedIds.length).toBe(ALL_ITEMS.length);
  });

  it('12. Massive document does not timeout (< 1 second)', () => {
    const editor = createSlateEditor({});

    // Create 1000 paragraphs of lorem ipsum — no matches possible
    const lorem =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.';

    editor.children = Array.from({ length: 1000 }, (_, i) => ({
      type: 'p',
      id: `lorem-${i}`,
      children: [{ text: `${lorem} Paragraph ${i}.` }],
    })) as never;

    const start = performance.now();
    const result = injectReviewItems(editor);
    const elapsed = performance.now() - start;

    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
    expect(result.skippedIds.length).toBe(ALL_ITEMS.length);
    expect(
      elapsed,
      `Injection took ${elapsed.toFixed(0)}ms — must be under 1000ms`,
    ).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// TYPE SAFETY
// ---------------------------------------------------------------------------

describe('Adversarial: Type safety', () => {
  beforeEach(() => {
    resetStore();
  });

  it('13. All injected items have correct shape — no undefined or null fields', async () => {
    const editor = await createRealEditor();
    injectReviewItems(editor);

    const state = useAnnotationStore.getState();

    for (const item of state.reviewItems) {
      // Required ReviewItem fields
      expect(item.type).toBe('reviewItem');
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.anchor).toBe('object');
      expect(item.anchor).not.toBeNull();
      expect(typeof item.anchor.paragraphId).toBe('string');
      expect(typeof item.anchor.startOffset).toBe('number');
      expect(typeof item.anchor.endOffset).toBe('number');
      expect(typeof item.anchor.exact).toBe('string');
      expect(typeof item.anchor.prefix).toBe('string');
      expect(typeof item.anchor.suffix).toBe('string');
      expect(['user', 'ai']).toContain(item.author);
      expect(['replace', 'insert', 'delete']).toContain(item.action);
      expect(typeof item.originalText).toBe('string');
      expect(typeof item.suggestedText).toBe('string');
      expect(typeof item.rationale).toBe('string');
      expect(item.rationale.length).toBeGreaterThan(0);
      expect(['critical', 'major', 'minor', 'info']).toContain(item.severity);
      expect(typeof item.clause).toBe('string');
      expect(['pending', 'accepted', 'rejected']).toContain(item.status);
      expect(typeof item.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
    }

    for (const disc of state.discussions) {
      // Required Discussion fields
      expect(disc.type).toBe('discussion');
      expect(typeof disc.id).toBe('string');
      expect(disc.id.length).toBeGreaterThan(0);
      expect(typeof disc.anchor).toBe('object');
      expect(disc.anchor).not.toBeNull();
      expect(typeof disc.author).toBe('string');
      expect(typeof disc.text).toBe('string');
      expect(disc.text.length).toBeGreaterThan(0);
      expect(typeof disc.quotedText).toBe('string');
      expect(disc.quotedText.length).toBeGreaterThan(0);
      expect(typeof disc.createdAt).toBe('string');
      expect(Number.isNaN(Date.parse(disc.createdAt))).toBe(false);
      // resolvedAt is string | null — must not be undefined
      expect(disc.resolvedAt === null || typeof disc.resolvedAt === 'string').toBe(
        true,
      );
    }
  });

  it('14. Discussion replies are actual arrays — not undefined, not null', async () => {
    const editor = await createRealEditor();
    injectReviewItems(editor);

    const state = useAnnotationStore.getState();

    for (const disc of state.discussions) {
      expect(
        Array.isArray(disc.replies),
        `Discussion ${disc.id} replies is not an array: ${typeof disc.replies}`,
      ).toBe(true);
      // Replies should not contain undefined or null entries
      for (let i = 0; i < disc.replies.length; i++) {
        expect(
          disc.replies[i],
          `Discussion ${disc.id} has null/undefined reply at index ${i}`,
        ).toBeDefined();
        expect(disc.replies[i]).not.toBeNull();
      }
    }
  });
});
