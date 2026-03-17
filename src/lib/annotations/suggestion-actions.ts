import type { SlateEditor, TText } from 'platejs';
import {
  acceptSuggestion as plateAcceptSuggestion,
  rejectSuggestion as plateRejectSuggestion,
  getInlineSuggestionData,
  getSuggestionKey,
  type TResolvedSuggestion,
} from '@platejs/suggestion';
import { useAnnotationStore } from '@/lib/annotations/store';

/**
 * Build a TResolvedSuggestion from the suggestion nodes in the editor.
 * Uses editor.api.suggestion.nodes() which correctly finds suggestion-marked text.
 * Returns null if the suggestion has no nodes in the document.
 */
function buildResolvedSuggestion(
  editor: SlateEditor,
  suggestionId: string,
): TResolvedSuggestion | null {
  // @ts-expect-error — Plate.js v52 plugin API not typed on base SlateEditor
  const allEntries = editor.api.suggestion.nodes() as Array<[Record<string, unknown>, number[]]>;
  const entries = allEntries.filter(([node]: [Record<string, unknown>, number[]]) => {
    const data = getInlineSuggestionData(node as TText);
    return data && data.id === suggestionId;
  });

  if (entries.length === 0) return null;

  const [firstNode] = entries[0];
  const data = getInlineSuggestionData(firstNode as TText);
  if (!data) return null;

  // Collect text by type
  let deletedText = '';
  let insertedText = '';

  for (const [node] of entries) {
    const nodeData = getInlineSuggestionData(node as TText);
    if (!nodeData) continue;

    const text = 'text' in node ? (node as { text: string }).text : '';
    if (nodeData.type === 'remove') {
      deletedText += text;
    } else if (nodeData.type === 'insert') {
      insertedText += text;
    }
  }

  // Determine the resolved type
  let type: TResolvedSuggestion['type'];
  if (deletedText && insertedText) {
    type = 'replace';
  } else if (deletedText) {
    type = 'remove';
  } else if (insertedText) {
    type = 'insert';
  } else {
    type = 'update';
  }

  return {
    createdAt: new Date(data.createdAt),
    keyId: getSuggestionKey(suggestionId),
    suggestionId,
    type,
    userId: data.userId,
    text: deletedText || undefined,
    newText: insertedText || undefined,
  };
}

/**
 * Accept a suggestion: apply the change to the document and update the store.
 * For insertions: keep the inserted text, remove marks.
 * For deletions: remove the deleted text.
 * For replacements: keep inserted text, remove deleted text.
 */
export function applySuggestionAccept(
  editor: SlateEditor,
  suggestionId: string,
): boolean {
  const resolved = buildResolvedSuggestion(editor, suggestionId);
  if (!resolved) return false;

  try {
    plateAcceptSuggestion(editor, resolved);
    useAnnotationStore.getState().acceptSuggestion(suggestionId);
    return true;
  } catch (err) {
    console.error('Failed to accept suggestion:', err);
    return false;
  }
}

/**
 * Reject a suggestion: remove the suggestion marks and restore original text.
 * For insertions: remove the inserted text.
 * For deletions: keep the original text, remove marks.
 * For replacements: remove inserted text, keep original.
 */
export function applySuggestionReject(
  editor: SlateEditor,
  suggestionId: string,
): boolean {
  const resolved = buildResolvedSuggestion(editor, suggestionId);
  if (!resolved) return false;

  try {
    plateRejectSuggestion(editor, resolved);
    useAnnotationStore.getState().rejectSuggestion(suggestionId);
    return true;
  } catch (err) {
    console.error('Failed to reject suggestion:', err);
    return false;
  }
}

/**
 * Resolve a comment: remove comment marks from the document and update the store.
 */
export function applyCommentResolve(
  editor: SlateEditor,
  commentId: string,
): void {
  try {
    // @ts-expect-error — Plate.js v52 plugin transforms not typed on base SlateEditor
    editor.tf.comment.unsetMark({ id: commentId });
  } catch {
    // Comment marks may already be removed
  }
  useAnnotationStore.getState().resolveDiscussion(commentId);
}
