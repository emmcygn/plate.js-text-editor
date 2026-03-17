import type { SlateEditor } from 'platejs';
import type { ReviewItem } from '@/types/annotations';
import { resolveAnchor } from '@/lib/anchoring';
import { useAnnotationStore } from '@/lib/annotations/store';
import { REVIEW_SUGGESTIONS, REVIEW_DISCUSSIONS } from './review-items';
import { applyCommentMark, applySuggestionMark } from './apply-marks';

export interface InjectionResult {
  injectedSuggestions: number;
  injectedDiscussions: number;
  skippedIds: string[];
}

/**
 * Inject all mock review items into the document and store.
 *
 * For each item:
 * 1. Resolve anchor against the live editor to verify the text exists
 * 2. Apply Slate marks (comment/suggestion marks on text nodes)
 * 3. Add to Zustand store (suggestions + discussions)
 *
 * Items with unresolvable anchors are silently skipped and reported
 * in the result's `skippedIds` array. Exceptions from `resolveAnchor`
 * are caught per-item so a single bad anchor doesn't abort the batch.
 */
export function injectReviewItems(editor: SlateEditor): InjectionResult {
  const store = useAnnotationStore.getState();
  const result: InjectionResult = {
    injectedSuggestions: 0,
    injectedDiscussions: 0,
    skippedIds: [],
  };

  // Inject suggestions with Slate marks
  const validSuggestions: ReviewItem[] = [];
  for (const item of REVIEW_SUGGESTIONS) {
    try {
      const range = resolveAnchor(editor, item.anchor);
      if (range) {
        try {
          applySuggestionMark(editor, range, item);

          // Verify marks were actually applied
          // @ts-expect-error — Plate.js v52 plugin API not typed on base SlateEditor
          const sugNodes = editor.api.suggestion.nodes() as Array<[Record<string, unknown>, number[]]>;
          const hasMarks = sugNodes.some(([node]: [Record<string, unknown>, number[]]) => {
            const key = `suggestion_${item.id}`;
            return node[key] !== undefined;
          });
          if (!hasMarks) {
            console.warn(`Marks not found after applying for ${item.id} — falling back to manual mark`);
            // Fallback: manually set marks on the text nodes in the range
            try {
              editor.tf.setNodes(
                {
                  suggestion: true,
                  [`suggestion_${item.id}`]: {
                    id: item.id,
                    createdAt: Date.now(),
                    type: 'remove',
                    userId: 'user-1',
                  },
                },
                {
                  at: range,
                  match: (n) => 'text' in n,
                  split: true,
                },
              );
            } catch {
              // Fallback also failed
            }
          }

          validSuggestions.push(item);
          result.injectedSuggestions++;
        } catch (markErr) {
          console.warn(`Failed to apply suggestion marks for ${item.id}:`, markErr);
          result.skippedIds.push(item.id);
        }
      } else {
        result.skippedIds.push(item.id);
      }
    } catch {
      result.skippedIds.push(item.id);
    }
  }

  if (validSuggestions.length > 0) {
    store.addBatchReviewItems(validSuggestions);
  }

  // Inject discussions with comment marks
  const existingDiscussionIds = new Set(
    store.discussions.map((d) => d.id),
  );
  for (const discussion of REVIEW_DISCUSSIONS) {
    if (existingDiscussionIds.has(discussion.id)) {
      result.injectedDiscussions++;
      continue;
    }
    try {
      const range = resolveAnchor(editor, discussion.anchor);
      if (range) {
        try {
          applyCommentMark(editor, range, discussion.id);
          store.addDiscussion(discussion);
          existingDiscussionIds.add(discussion.id);
          result.injectedDiscussions++;
        } catch (markErr) {
          console.warn(`Failed to apply comment marks for ${discussion.id}:`, markErr);
          result.skippedIds.push(discussion.id);
        }
      } else {
        result.skippedIds.push(discussion.id);
      }
    } catch {
      result.skippedIds.push(discussion.id);
    }
  }

  return result;
}

/**
 * Orchestrates the full review flow:
 * 1. Set loading state
 * 2. Wait 1500ms (simulate AI processing)
 * 3. Inject all items
 * 4. Clear loading state
 *
 * Returns a promise that resolves with the injection result.
 * Guards against double-invocation via `isReviewLoading`.
 * Uses try/finally to guarantee loading state is always cleared.
 */
export function triggerReview(editor: SlateEditor): Promise<InjectionResult> {
  // TODO: Replace mock setTimeout with real AI API call (e.g., Claude API). The injection pipeline handles arbitrary ReviewItem[], so only the data source changes.
  const store = useAnnotationStore.getState();

  // Guard: prevent double-trigger
  if (store.isReviewLoading) {
    return Promise.resolve({
      injectedSuggestions: 0,
      injectedDiscussions: 0,
      skippedIds: [],
    });
  }

  store.setReviewLoading(true);

  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const result = injectReviewItems(editor);
        resolve(result);
      } catch {
        resolve({
          injectedSuggestions: 0,
          injectedDiscussions: 0,
          skippedIds: [],
        });
      } finally {
        store.setReviewLoading(false);
      }
    }, 1500);
  });
}
