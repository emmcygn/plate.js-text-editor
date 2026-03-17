import type { TRange, SlateEditor } from 'platejs';
import { getCommentKey } from '@platejs/comment';
import { setSuggestionNodes, getSuggestionKey } from '@platejs/suggestion';
import type { ReviewItem } from '@/types/annotations';

/**
 * Apply comment marks (comment_<id>: true) at the given range.
 */
export function applyCommentMark(
  editor: SlateEditor,
  range: TRange,
  commentId: string,
): void {
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  editor.select(range);
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  editor.addMark('comment', true);
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  editor.addMark(getCommentKey(commentId), true);
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  editor.deselect();
}

/**
 * Apply suggestion marks at the given range based on the review item's action.
 *
 * - delete: mark original text as deletion suggestion
 * - replace: mark original text as deletion, then insert replacement with SAME ID
 * - insert: insert new text at range start as insertion suggestion
 *
 * IMPORTANT: We manually insert suggestion nodes instead of using
 * `insertTextSuggestion` because that API generates its own nanoid,
 * making the insertion node unmatchable by the reject/accept logic
 * which looks up nodes by the original suggestion ID.
 */
export function applySuggestionMark(
  editor: SlateEditor,
  range: TRange,
  item: ReviewItem,
): void {
  const { action, suggestedText, id } = item;
  const createdAt = Date.now();
  const userId = 'user-1';

  if (action === 'delete') {
    setSuggestionNodes(editor, {
      at: range,
      suggestionId: id,
      suggestionDeletion: true,
      createdAt,
    });
  } else if (action === 'replace') {
    // Step 1: Mark original text as deletion
    setSuggestionNodes(editor, {
      at: range,
      suggestionId: id,
      suggestionDeletion: true,
      createdAt,
    });

    // Step 2: Find the end of the deleted text
    // @ts-expect-error — Plate.js v52 plugin API not typed on base SlateEditor
    const sugNodes = editor.api.suggestion.nodes() as Array<[Record<string, unknown>, number[]]>;
    let lastDeletePath: number[] | null = null;
    let lastDeleteOffset = 0;

    for (const [node, path] of sugNodes) {
      const nodeAny = node as Record<string, unknown>;
      const sugKey = getSuggestionKey(id);
      const sugData = nodeAny[sugKey] as { type?: string } | undefined;
      if (sugData && sugData.type === 'remove') {
        lastDeletePath = path;
        lastDeleteOffset = typeof nodeAny.text === 'string' ? nodeAny.text.length : 0;
      }
    }

    if (lastDeletePath) {
      // Step 3: Insert replacement text with the SAME suggestion ID
      const insertPoint = { path: lastDeletePath, offset: lastDeleteOffset };
      editor.tf.insertNodes(
        {
          text: suggestedText,
          suggestion: true,
          [getSuggestionKey(id)]: {
            id,
            createdAt,
            type: 'insert',
            userId,
          },
        },
        { at: insertPoint, select: false },
      );
    }
  } else if (action === 'insert') {
    // Insert new text with the suggestion ID
    const insertPoint = range.anchor;
    editor.tf.insertNodes(
      {
        text: suggestedText,
        suggestion: true,
        [getSuggestionKey(id)]: {
          id,
          createdAt,
          type: 'insert',
          userId,
        },
      },
      { at: insertPoint, select: false },
    );
  }

  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  editor.deselect();
}
