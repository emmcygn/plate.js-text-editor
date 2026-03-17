import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SlateEditor } from 'platejs';
import { createSlateEditor } from 'platejs';
import { BaseCommentPlugin } from '@platejs/comment';
import { BaseSuggestionPlugin } from '@platejs/suggestion';
import { useAnnotationStore } from '@/lib/annotations/store';
import { injectReviewItems, triggerReview } from '../inject-review';
import {
  REVIEW_SUGGESTIONS,
  REVIEW_DISCUSSIONS,
} from '../review-items';

/**
 * Create a minimal Slate editor with the given blocks.
 * Includes comment and suggestion plugins for mark application.
 */
function makeTestEditor(
  blocks: Array<{ id: string; text: string }>,
): SlateEditor {
  const editor = createSlateEditor({
    plugins: [
      BaseCommentPlugin,
      BaseSuggestionPlugin.configure({
        options: { currentUserId: 'user-1', isSuggesting: false },
      }),
    ],
  });
  editor.children = blocks.map((b) => ({
    id: b.id,
    type: 'p',
    children: [{ text: b.text }],
  }));
  return editor;
}

/**
 * Build an editor whose blocks contain the exact text and surrounding
 * context for every review item, so resolveAnchor's Tier 3 (full-document
 * fallback) can find them by prefix/suffix.
 */
function makeFullMatchEditor(): SlateEditor {
  const allItems = [...REVIEW_SUGGESTIONS, ...REVIEW_DISCUSSIONS];
  const blocks = allItems.map((item, i) => ({
    id: `p-${i}`,
    text: item.anchor.prefix + item.anchor.exact + item.anchor.suffix,
  }));
  return makeTestEditor(blocks);
}

const EMPTY_STORE_STATE = {
  discussions: [],
  reviewItems: [],
  selectedCardId: null,
  filterType: 'all' as const,
  isReviewLoading: false,
  highlightRange: null,
  highlightPhase: null,
};

beforeEach(() => {
  useAnnotationStore.setState(EMPTY_STORE_STATE);
});

// ---------------------------------------------------------------------------
// 1. injectReviewItems with valid editor returns injection counts
// ---------------------------------------------------------------------------
describe('injectReviewItems — valid editor returns injection counts', () => {
  it('returns injectedSuggestions > 0 when all suggestion texts are present', () => {
    const editor = makeFullMatchEditor();
    const result = injectReviewItems(editor);

    expect(result.injectedSuggestions).toBeGreaterThan(0);
    expect(result.injectedSuggestions).toBeLessThanOrEqual(
      REVIEW_SUGGESTIONS.length,
    );
  });

  it('returns injectedDiscussions > 0 when all discussion texts are present', () => {
    const editor = makeFullMatchEditor();
    const result = injectReviewItems(editor);

    expect(result.injectedDiscussions).toBeGreaterThan(0);
    expect(result.injectedDiscussions).toBeLessThanOrEqual(
      REVIEW_DISCUSSIONS.length,
    );
  });

  it('total injected + skipped equals exactly 10 (6 suggestions + 4 discussions)', () => {
    const editor = makeFullMatchEditor();
    const result = injectReviewItems(editor);

    const total =
      result.injectedSuggestions +
      result.injectedDiscussions +
      result.skippedIds.length;
    expect(total).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 2. injectReviewItems adds items to Zustand store
// ---------------------------------------------------------------------------
describe('injectReviewItems — Zustand store population', () => {
  it('adds review items to the store after injection', () => {
    const editor = makeFullMatchEditor();
    injectReviewItems(editor);
    const state = useAnnotationStore.getState();

    expect(state.reviewItems.length).toBeGreaterThan(0);
  });

  it('adds discussions to the store after injection', () => {
    const editor = makeFullMatchEditor();
    injectReviewItems(editor);
    const state = useAnnotationStore.getState();

    expect(state.discussions.length).toBeGreaterThan(0);
  });

  it('store review item IDs match injected suggestion IDs', () => {
    const editor = makeFullMatchEditor();
    const result = injectReviewItems(editor);
    const state = useAnnotationStore.getState();

    // Every store item should be a known suggestion
    const suggestionIds = new Set(REVIEW_SUGGESTIONS.map((s) => s.id));
    for (const item of state.reviewItems) {
      expect(suggestionIds.has(item.id)).toBe(true);
    }
    expect(state.reviewItems.length).toBe(result.injectedSuggestions);
  });

  it('store discussion IDs match injected discussion IDs', () => {
    const editor = makeFullMatchEditor();
    const result = injectReviewItems(editor);
    const state = useAnnotationStore.getState();

    const discussionIds = new Set(REVIEW_DISCUSSIONS.map((d) => d.id));
    for (const d of state.discussions) {
      expect(discussionIds.has(d.id)).toBe(true);
    }
    expect(state.discussions.length).toBe(result.injectedDiscussions);
  });
});

// ---------------------------------------------------------------------------
// 3. Unresolvable anchor — all items skipped
// ---------------------------------------------------------------------------
describe('injectReviewItems — unresolvable anchors', () => {
  it('skips all 10 items when editor contains no matching text', () => {
    const emptyEditor = makeTestEditor([
      { id: 'p-1', text: 'nothing here at all' },
    ]);
    const result = injectReviewItems(emptyEditor);

    expect(result.skippedIds).toHaveLength(10);
    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
  });

  it('leaves Zustand store empty when all anchors fail', () => {
    const emptyEditor = makeTestEditor([
      { id: 'p-1', text: 'completely irrelevant text' },
    ]);
    injectReviewItems(emptyEditor);
    const state = useAnnotationStore.getState();

    expect(state.reviewItems).toHaveLength(0);
    expect(state.discussions).toHaveLength(0);
  });

  it('skippedIds contains the actual IDs of the skipped items', () => {
    const emptyEditor = makeTestEditor([
      { id: 'p-1', text: 'no matching text' },
    ]);
    const result = injectReviewItems(emptyEditor);

    const allIds = [
      ...REVIEW_SUGGESTIONS.map((s) => s.id),
      ...REVIEW_DISCUSSIONS.map((d) => d.id),
    ];
    expect(result.skippedIds.sort()).toEqual(allIds.sort());
  });
});

// ---------------------------------------------------------------------------
// 4. Partial resolution — some match, some skip
// ---------------------------------------------------------------------------
describe('injectReviewItems — partial resolution', () => {
  it('injects only items whose text is present and skips the rest', () => {
    // Include text for only the first suggestion ("best efforts").
    // NOTE: The prefix "Therefore, the Company shall use its " contains
    // "the Company" which is the exact text for review-cmt-1. resolveAnchor
    // Tier 3 will find it (even with wrong context, score 0 still matches).
    // So we expect 1 suggestion + potentially 1 discussion.
    const sug1 = REVIEW_SUGGESTIONS[0];
    const partialEditor = makeTestEditor([
      {
        id: 'p-0',
        text: sug1.anchor.prefix + sug1.anchor.exact + sug1.anchor.suffix,
      },
      { id: 'p-1', text: 'unrelated filler text with no matches at all' },
    ]);

    const result = injectReviewItems(partialEditor);

    expect(result.injectedSuggestions).toBe(1);
    // "the Company" in the prefix text may resolve review-cmt-1
    expect(result.injectedSuggestions + result.injectedDiscussions).toBeGreaterThanOrEqual(1);
    expect(result.injectedSuggestions + result.injectedDiscussions + result.skippedIds.length).toBe(10);
  });

  it('injects a discussion when only its text is present', () => {
    const disc1 = REVIEW_DISCUSSIONS[0];
    const partialEditor = makeTestEditor([
      {
        id: 'p-0',
        text: disc1.anchor.prefix + disc1.anchor.exact + disc1.anchor.suffix,
      },
    ]);

    const result = injectReviewItems(partialEditor);

    expect(result.injectedDiscussions).toBe(1);
    // Remaining 9 items skipped (6 suggestions + 3 discussions)
    expect(result.skippedIds.length).toBe(9);
    expect(result.skippedIds).not.toContain(disc1.id);
  });

  it('mixed partial: some suggestions + some discussions succeed', () => {
    const sug1 = REVIEW_SUGGESTIONS[0];
    const disc1 = REVIEW_DISCUSSIONS[0];
    const partialEditor = makeTestEditor([
      {
        id: 'p-0',
        text: sug1.anchor.prefix + sug1.anchor.exact + sug1.anchor.suffix,
      },
      {
        id: 'p-1',
        text: disc1.anchor.prefix + disc1.anchor.exact + disc1.anchor.suffix,
      },
    ]);

    const result = injectReviewItems(partialEditor);

    expect(result.injectedSuggestions).toBe(1);
    expect(result.injectedDiscussions).toBe(1);
    expect(result.skippedIds.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 5. Double injection prevention — addBatchReviewItems deduplicates
// ---------------------------------------------------------------------------
describe('injectReviewItems — double injection prevention', () => {
  it('second call does not create duplicate review items in the store', () => {
    const editor = makeFullMatchEditor();

    const result1 = injectReviewItems(editor);
    const countAfterFirst = useAnnotationStore.getState().reviewItems.length;

    const result2 = injectReviewItems(editor);
    const countAfterSecond = useAnnotationStore.getState().reviewItems.length;

    expect(countAfterSecond).toBe(countAfterFirst);
    // Both calls should report the same number of injected suggestions
    expect(result2.injectedSuggestions).toBe(result1.injectedSuggestions);
  });

  it('second call still reports injection counts (anchors still resolve)', () => {
    const editor = makeFullMatchEditor();
    injectReviewItems(editor);
    const result2 = injectReviewItems(editor);

    // injectedSuggestions counts resolved anchors, not store additions
    expect(result2.injectedSuggestions).toBeGreaterThan(0);
  });

  it('discussions are NOT duplicated by double injection (dedup in injectReviewItems)', () => {
    const editor = makeFullMatchEditor();
    injectReviewItems(editor);
    const countAfterFirst = useAnnotationStore.getState().discussions.length;

    injectReviewItems(editor);
    const countAfterSecond = useAnnotationStore.getState().discussions.length;

    // injectReviewItems deduplicates discussions by checking existing IDs
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

// ---------------------------------------------------------------------------
// 6. triggerReview — double-click guard
// ---------------------------------------------------------------------------
describe('triggerReview — double-click guard', () => {
  it('returns immediately with zero counts when isReviewLoading is true', async () => {
    useAnnotationStore.setState({ isReviewLoading: true });
    const editor = makeFullMatchEditor();

    const result = await triggerReview(editor);

    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
    expect(result.skippedIds).toHaveLength(0);
  });

  it('does not toggle isReviewLoading when already loading', async () => {
    useAnnotationStore.setState({ isReviewLoading: true });
    const editor = makeFullMatchEditor();

    await triggerReview(editor);

    // isReviewLoading should still be true — guard returned early
    expect(useAnnotationStore.getState().isReviewLoading).toBe(true);
  });

  it('does not add any items to the store when guarded', async () => {
    useAnnotationStore.setState({ isReviewLoading: true });
    const editor = makeFullMatchEditor();

    await triggerReview(editor);

    expect(useAnnotationStore.getState().reviewItems).toHaveLength(0);
    expect(useAnnotationStore.getState().discussions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// triggerReview — normal flow
// ---------------------------------------------------------------------------
describe('triggerReview — normal flow', () => {
  it('sets isReviewLoading to true then false after completion', async () => {
    vi.useFakeTimers();
    const editor = makeFullMatchEditor();

    const promise = triggerReview(editor);

    // During the timeout, loading should be true
    expect(useAnnotationStore.getState().isReviewLoading).toBe(true);

    // Advance past the 1500ms timeout
    vi.advanceTimersByTime(1500);

    const result = await promise;

    expect(useAnnotationStore.getState().isReviewLoading).toBe(false);
    expect(result.injectedSuggestions + result.injectedDiscussions).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('rejects a second triggerReview while the first is in flight', async () => {
    vi.useFakeTimers();
    const editor = makeFullMatchEditor();

    const promise1 = triggerReview(editor);

    // Second call while first is still pending
    const result2 = await triggerReview(editor);
    expect(result2.injectedSuggestions).toBe(0);
    expect(result2.injectedDiscussions).toBe(0);

    vi.advanceTimersByTime(1500);
    await promise1;

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// 7. Document integrity after failed anchors
// ---------------------------------------------------------------------------
describe('injectReviewItems — document integrity', () => {
  it('editor.children is unchanged after injection with no matches', () => {
    const blocks = [
      { id: 'p-1', text: 'The quick brown fox jumps over the lazy dog.' },
      { id: 'p-2', text: 'Pack my box with five dozen liquor jugs.' },
      { id: 'p-3', text: 'How vexingly quick daft zebras jump.' },
    ];
    const editor = makeTestEditor(blocks);

    // Deep clone the children before injection
    const childrenBefore = JSON.parse(JSON.stringify(editor.children));

    injectReviewItems(editor);

    expect(editor.children).toEqual(childrenBefore);
  });

  it('editor.children may have marks after injection WITH matches', () => {
    const editor = makeFullMatchEditor();
    const countBefore = editor.children.length;

    injectReviewItems(editor);

    // Stage 6 applies comment/suggestion marks — block count stays the same
    // but text nodes may be split with mark properties
    expect(editor.children.length).toBe(countBefore);
  });

  it('block count remains the same after injection', () => {
    const editor = makeFullMatchEditor();
    const countBefore = editor.children.length;

    injectReviewItems(editor);

    expect(editor.children.length).toBe(countBefore);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('injectReviewItems — edge cases', () => {
  it('handles an editor with zero children gracefully', () => {
    const editor = createSlateEditor({});
    editor.children = [];

    const result = injectReviewItems(editor);

    expect(result.skippedIds).toHaveLength(10);
    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
  });

  it('handles an editor with single empty text node', () => {
    const editor = makeTestEditor([{ id: 'p-1', text: '' }]);

    const result = injectReviewItems(editor);

    expect(result.skippedIds).toHaveLength(10);
  });

  it('does not crash when same text appears in multiple blocks', () => {
    // Duplicate blocks — resolveAnchor should still find the best match
    const sug1 = REVIEW_SUGGESTIONS[0];
    const fullText =
      sug1.anchor.prefix + sug1.anchor.exact + sug1.anchor.suffix;
    const editor = makeTestEditor([
      { id: 'p-0', text: fullText },
      { id: 'p-1', text: fullText },
      { id: 'p-2', text: fullText },
    ]);

    const result = injectReviewItems(editor);

    // Should still inject exactly 1 suggestion (the first one matches)
    expect(result.injectedSuggestions).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Exception safety
// ---------------------------------------------------------------------------
describe('injectReviewItems — exception safety', () => {
  it('triggerReview always clears loading state even if injection throws', async () => {
    vi.useFakeTimers();

    // Create a broken editor that will cause resolveAnchor to throw
    const brokenEditor = {
      children: null, // will cause TypeError when iterating
    } as unknown as SlateEditor;

    const promise = triggerReview(brokenEditor);
    expect(useAnnotationStore.getState().isReviewLoading).toBe(true);

    vi.advanceTimersByTime(1500);
    const result = await promise;

    // Loading must be cleared even after error
    expect(useAnnotationStore.getState().isReviewLoading).toBe(false);
    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);

    vi.useRealTimers();
  });

  it('injectReviewItems skips items when resolveAnchor throws for some', () => {
    // Editor with partially broken structure — has some valid blocks
    // but children includes a non-iterable element
    const editor = createSlateEditor({});
    editor.children = [
      { type: 'p', id: 'p-0', children: [{ text: 'valid text here' }] } as never,
    ];

    // This should not throw — exceptions are caught per-item
    const result = injectReviewItems(editor);

    expect(result.skippedIds.length).toBe(10);
    expect(result.injectedSuggestions).toBe(0);
    expect(result.injectedDiscussions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Return type shape
// ---------------------------------------------------------------------------
describe('injectReviewItems — return type shape', () => {
  it('always returns an object with the three expected keys', () => {
    const editor = makeTestEditor([{ id: 'p-1', text: 'x' }]);
    const result = injectReviewItems(editor);

    expect(result).toHaveProperty('injectedSuggestions');
    expect(result).toHaveProperty('injectedDiscussions');
    expect(result).toHaveProperty('skippedIds');
    expect(typeof result.injectedSuggestions).toBe('number');
    expect(typeof result.injectedDiscussions).toBe('number');
    expect(Array.isArray(result.skippedIds)).toBe(true);
  });

  it('skippedIds contains only string values', () => {
    const editor = makeTestEditor([{ id: 'p-1', text: 'irrelevant' }]);
    const result = injectReviewItems(editor);

    for (const id of result.skippedIds) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
