import { create } from 'zustand';
import type { TRange } from 'platejs';
import type {
  Annotation,
  Discussion,
  ReviewItem,
  ReviewItemStatus,
} from '@/types/annotations';

export type FilterType = 'all' | 'comment' | 'suggestion';

interface AnnotationState {
  discussions: Discussion[];
  reviewItems: ReviewItem[];
  selectedCardId: string | null;
  filterType: FilterType;
  isReviewLoading: boolean;
  highlightRange: TRange | null;
  highlightPhase: 'active' | null;
  /** Temporary flash after accept/reject — shows where the change landed. */
  flashRange: TRange | null;
  flashType: 'accepted' | 'rejected' | null;
}

interface AnnotationActions {
  addDiscussion: (discussion: Discussion) => void;
  addReviewItem: (item: ReviewItem) => void;
  addBatchReviewItems: (items: ReviewItem[]) => void;
  setSelectedCard: (id: string | null) => void;
  setFilterType: (type: FilterType) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  resolveDiscussion: (id: string) => void;
  setReviewLoading: (loading: boolean) => void;
  setHighlightRange: (range: TRange | null) => void;
  setHighlightPhase: (phase: 'active' | null) => void;
  /** Show a temporary flash highlight that auto-clears after 3 seconds. */
  setFlash: (range: TRange, type: 'accepted' | 'rejected') => void;
  clearFlash: () => void;
  getAnnotationsByPosition: () => Annotation[];
  resetStore: () => void;
}

export type AnnotationStore = AnnotationState & AnnotationActions;

/** Compare two annotations by their anchor's paragraph position (numeric suffix). */
function compareParagraphPosition(a: Annotation, b: Annotation): number {
  const aNum = extractParagraphIndex(a.anchor.paragraphId);
  const bNum = extractParagraphIndex(b.anchor.paragraphId);
  if (aNum !== bNum) return aNum - bNum;
  return a.anchor.startOffset - b.anchor.startOffset;
}

/** Extract a numeric index from a paragraph ID for sorting. Falls back to string comparison. */
function extractParagraphIndex(id: string): number {
  const match = id.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function updateReviewItemStatus(
  items: ReviewItem[],
  id: string,
  status: ReviewItemStatus,
): ReviewItem[] {
  return items.map((item) =>
    item.id === id && item.status === 'pending' ? { ...item, status } : item,
  );
}

// TODO: Add persistence layer (localStorage or backend API). Currently all annotation state is in-memory and lost on refresh.
export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  // State
  discussions: [],
  reviewItems: [],
  selectedCardId: null,
  filterType: 'all',
  isReviewLoading: false,
  highlightRange: null,
  highlightPhase: null,
  flashRange: null,
  flashType: null,

  // Actions
  addDiscussion: (discussion) =>
    set((state) => ({ discussions: [...state.discussions, discussion] })),

  addReviewItem: (item) =>
    set((state) => ({ reviewItems: [...state.reviewItems, item] })),

  addBatchReviewItems: (items) =>
    set((state) => {
      const existingIds = new Set(state.reviewItems.map((r) => r.id));
      const unique: ReviewItem[] = [];
      for (const item of items) {
        if (!existingIds.has(item.id)) {
          existingIds.add(item.id);
          unique.push(item);
        }
      }
      return { reviewItems: [...state.reviewItems, ...unique] };
    }),

  setSelectedCard: (id) => set({ selectedCardId: id }),

  setFilterType: (type) => set({ filterType: type }),

  acceptSuggestion: (id) =>
    set((state) => ({
      reviewItems: updateReviewItemStatus(state.reviewItems, id, 'accepted'),
    })),

  rejectSuggestion: (id) =>
    set((state) => ({
      reviewItems: updateReviewItemStatus(state.reviewItems, id, 'rejected'),
    })),

  resolveDiscussion: (id) =>
    set((state) => ({
      discussions: state.discussions.map((d) =>
        d.id === id && !d.resolvedAt
          ? { ...d, resolvedAt: new Date().toISOString() }
          : d,
      ),
    })),

  setReviewLoading: (loading) => set({ isReviewLoading: loading }),

  setHighlightRange: (range) => set({ highlightRange: range }),

  setHighlightPhase: (phase) => set({ highlightPhase: phase }),

  setFlash: (range, type) => {
    set({ flashRange: range, flashType: type });
    setTimeout(() => {
      // Only clear if the flash hasn't been replaced by a newer one
      const current = get();
      if (current.flashRange === range) {
        set({ flashRange: null, flashType: null });
      }
    }, 3000);
  },

  clearFlash: () => set({ flashRange: null, flashType: null }),

  resetStore: () =>
    set({
      discussions: [],
      reviewItems: [],
      selectedCardId: null,
      highlightRange: null,
      highlightPhase: null,
      flashRange: null,
      flashType: null,
      filterType: 'all',
      isReviewLoading: false,
    }),

  getAnnotationsByPosition: () => {
    const { discussions, reviewItems, filterType } = get();
    let annotations: Annotation[] = [];

    if (filterType === 'all' || filterType === 'comment') {
      annotations = [...annotations, ...discussions];
    }
    if (filterType === 'all' || filterType === 'suggestion') {
      annotations = [...annotations, ...reviewItems];
    }

    return annotations.sort(compareParagraphPosition);
  },
}));
