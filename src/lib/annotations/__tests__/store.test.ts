import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnotationStore } from '../store';
import type { Discussion, ReviewItem } from '@/types/annotations';

function makeAnchor(paragraphId: string, startOffset = 0, endOffset = 10) {
  return {
    paragraphId,
    startOffset,
    endOffset,
    exact: 'test text',
    prefix: 'before ',
    suffix: ' after',
  };
}

function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    type: 'discussion',
    id: `d-${Math.random().toString(36).slice(2, 8)}`,
    anchor: makeAnchor('p-1'),
    author: 'user',
    text: 'A comment',
    quotedText: 'test text',
    replies: [],
    resolvedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    type: 'reviewItem',
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    anchor: makeAnchor('p-1'),
    author: 'ai',
    action: 'replace',
    originalText: 'original',
    suggestedText: 'suggested',
    rationale: 'Improves clarity',
    severity: 'minor',
    clause: '3.1',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  useAnnotationStore.setState({
    discussions: [],
    reviewItems: [],
    selectedCardId: null,
    filterType: 'all',
    isReviewLoading: false,
  });
});

describe('Annotation Store — Unit Tests', () => {
  it('adds a discussion', () => {
    const d = makeDiscussion();
    useAnnotationStore.getState().addDiscussion(d);
    expect(useAnnotationStore.getState().discussions).toHaveLength(1);
    expect(useAnnotationStore.getState().discussions[0].id).toBe(d.id);
  });

  it('adds a single review item', () => {
    const r = makeReviewItem();
    useAnnotationStore.getState().addReviewItem(r);
    expect(useAnnotationStore.getState().reviewItems).toHaveLength(1);
  });

  it('adds batch review items', () => {
    const items = [makeReviewItem({ id: 'r-1' }), makeReviewItem({ id: 'r-2' }), makeReviewItem({ id: 'r-3' })];
    useAnnotationStore.getState().addBatchReviewItems(items);
    expect(useAnnotationStore.getState().reviewItems).toHaveLength(3);
  });

  it('accepts a pending suggestion', () => {
    const r = makeReviewItem({ id: 'r-accept' });
    useAnnotationStore.getState().addReviewItem(r);
    useAnnotationStore.getState().acceptSuggestion('r-accept');
    expect(useAnnotationStore.getState().reviewItems[0].status).toBe('accepted');
  });

  it('rejects a pending suggestion', () => {
    const r = makeReviewItem({ id: 'r-reject' });
    useAnnotationStore.getState().addReviewItem(r);
    useAnnotationStore.getState().rejectSuggestion('r-reject');
    expect(useAnnotationStore.getState().reviewItems[0].status).toBe('rejected');
  });

  it('resolves a discussion', () => {
    const d = makeDiscussion({ id: 'd-resolve' });
    useAnnotationStore.getState().addDiscussion(d);
    useAnnotationStore.getState().resolveDiscussion('d-resolve');
    const resolved = useAnnotationStore.getState().discussions[0];
    expect(resolved.resolvedAt).toBeTruthy();
  });

  it('sorts annotations by paragraph position', () => {
    const d1 = makeDiscussion({ id: 'd-50', anchor: makeAnchor('p-50') });
    const d2 = makeDiscussion({ id: 'd-10', anchor: makeAnchor('p-10') });
    const r1 = makeReviewItem({ id: 'r-30', anchor: makeAnchor('p-30') });

    const state = useAnnotationStore.getState();
    state.addDiscussion(d1);
    state.addDiscussion(d2);
    state.addReviewItem(r1);

    const sorted = useAnnotationStore.getState().getAnnotationsByPosition();
    expect(sorted.map((a) => a.id)).toEqual(['d-10', 'r-30', 'd-50']);
  });

  it('sorts by startOffset within same paragraph', () => {
    const r1 = makeReviewItem({ id: 'r-late', anchor: makeAnchor('p-1', 100, 110) });
    const r2 = makeReviewItem({ id: 'r-early', anchor: makeAnchor('p-1', 10, 20) });

    const state = useAnnotationStore.getState();
    state.addReviewItem(r1);
    state.addReviewItem(r2);

    const sorted = state.getAnnotationsByPosition();
    expect(sorted.map((a) => a.id)).toEqual(['r-early', 'r-late']);
  });

  it('filters by comment type', () => {
    const d = makeDiscussion();
    const r = makeReviewItem();
    const state = useAnnotationStore.getState();
    state.addDiscussion(d);
    state.addReviewItem(r);
    state.setFilterType('comment');

    const filtered = useAnnotationStore.getState().getAnnotationsByPosition();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('discussion');
  });

  it('filters by suggestion type', () => {
    const d = makeDiscussion();
    const r = makeReviewItem();
    const state = useAnnotationStore.getState();
    state.addDiscussion(d);
    state.addReviewItem(r);
    state.setFilterType('suggestion');

    const filtered = useAnnotationStore.getState().getAnnotationsByPosition();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('reviewItem');
  });

  it('sets and clears selected card', () => {
    useAnnotationStore.getState().setSelectedCard('abc');
    expect(useAnnotationStore.getState().selectedCardId).toBe('abc');
    useAnnotationStore.getState().setSelectedCard(null);
    expect(useAnnotationStore.getState().selectedCardId).toBeNull();
  });

  it('sets review loading state', () => {
    useAnnotationStore.getState().setReviewLoading(true);
    expect(useAnnotationStore.getState().isReviewLoading).toBe(true);
    useAnnotationStore.getState().setReviewLoading(false);
    expect(useAnnotationStore.getState().isReviewLoading).toBe(false);
  });
});

describe('Annotation Store — Adversarial Tests', () => {
  it('double-accept keeps status as accepted', () => {
    const r = makeReviewItem({ id: 'r-double' });
    const state = useAnnotationStore.getState();
    state.addReviewItem(r);
    state.acceptSuggestion('r-double');
    state.acceptSuggestion('r-double');
    expect(useAnnotationStore.getState().reviewItems[0].status).toBe('accepted');
  });

  it('accept on non-existent ID does not throw', () => {
    expect(() => {
      useAnnotationStore.getState().acceptSuggestion('fake-id');
    }).not.toThrow();
    expect(useAnnotationStore.getState().reviewItems).toHaveLength(0);
  });

  it('reject on non-existent ID does not throw', () => {
    expect(() => {
      useAnnotationStore.getState().rejectSuggestion('fake-id');
    }).not.toThrow();
  });

  it('resolve on non-existent discussion does not throw', () => {
    expect(() => {
      useAnnotationStore.getState().resolveDiscussion('fake-id');
    }).not.toThrow();
  });

  it('duplicate IDs in batch are deduplicated', () => {
    const item = makeReviewItem({ id: 'r-dup' });
    const state = useAnnotationStore.getState();
    state.addBatchReviewItems([item, { ...item }, { ...item }]);
    expect(useAnnotationStore.getState().reviewItems).toHaveLength(1);
  });

  it('batch does not add items that already exist in store', () => {
    const existing = makeReviewItem({ id: 'r-exists' });
    useAnnotationStore.getState().addReviewItem(existing);
    useAnnotationStore.getState().addBatchReviewItems([
      makeReviewItem({ id: 'r-exists' }),
      makeReviewItem({ id: 'r-new' }),
    ]);
    expect(useAnnotationStore.getState().reviewItems).toHaveLength(2);
  });

  it('reject after accept does not change status back', () => {
    const r = makeReviewItem({ id: 'r-flip' });
    const state = useAnnotationStore.getState();
    state.addReviewItem(r);
    state.acceptSuggestion('r-flip');
    state.rejectSuggestion('r-flip');
    expect(useAnnotationStore.getState().reviewItems[0].status).toBe('accepted');
  });
});
