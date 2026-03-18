import type { SlateEditor, TText, Path } from 'platejs';
import {
  acceptSuggestion as plateAcceptSuggestion,
  rejectSuggestion as plateRejectSuggestion,
  getInlineSuggestionData,
  getSuggestionKey,
  type TResolvedSuggestion,
} from '@platejs/suggestion';
import { useAnnotationStore } from '@/lib/annotations/store';
import { offsetToSlateRange } from '@/lib/anchoring/offset-to-range';

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
 * Get the paragraph path (block-level ancestor) for the first suggestion node.
 * Used to relocate the affected text after Plate mutates the tree.
 */
function getSuggestionBlockPath(
  editor: SlateEditor,
  suggestionId: string,
): Path | null {
  // @ts-expect-error — Plate.js v52 plugin API not typed on base SlateEditor
  const allEntries = editor.api.suggestion.nodes() as Array<[Record<string, unknown>, number[]]>;
  const entry = allEntries.find(([node]: [Record<string, unknown>, number[]]) => {
    const data = getInlineSuggestionData(node as TText);
    return data && data.id === suggestionId;
  });

  if (!entry) return null;

  // Text node path is e.g. [3, 2] — the block is [3]
  const textPath = entry[1];
  return textPath.length > 1 ? textPath.slice(0, 1) : textPath;
}

/**
 * After a Plate accept/reject mutation, find the resulting text in the
 * paragraph and flash-highlight it. The text to find is:
 *   - Accept: newText (the inserted replacement that was kept)
 *   - Reject: text (the original deleted text that was restored)
 */
function flashResultText(
  editor: SlateEditor,
  blockPath: Path,
  textToFind: string,
  type: 'accepted' | 'rejected',
): void {
  if (!textToFind) return;

  // Extract the paragraph's full text after the mutation
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  const blockEntry = editor.node(blockPath) as [Record<string, unknown>, Path] | undefined;
  if (!blockEntry) return;

  const fullText = extractBlockText(blockEntry[0]);
  const idx = fullText.indexOf(textToFind);
  if (idx === -1) return;

  const range = offsetToSlateRange(editor, blockPath, idx, idx + textToFind.length);
  if (range) {
    useAnnotationStore.getState().setFlash(range, type);
  }
}

/** Extract plain text from a Slate node tree. */
function extractBlockText(node: Record<string, unknown>): string {
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.children)) {
    return (node.children as Record<string, unknown>[]).map(extractBlockText).join('');
  }
  return '';
}

/**
 * Accept a suggestion: apply the change to the document and update the store.
 * Shows a 3-second flash highlight on the resulting text.
 */
export function applySuggestionAccept(
  editor: SlateEditor,
  suggestionId: string,
): boolean {
  const resolved = buildResolvedSuggestion(editor, suggestionId);
  if (!resolved) return false;

  // Capture block path before the operation mutates the tree
  const blockPath = getSuggestionBlockPath(editor, suggestionId);

  try {
    plateAcceptSuggestion(editor, resolved);
    useAnnotationStore.getState().acceptSuggestion(suggestionId);

    // Flash the accepted text (newText = the inserted replacement that was kept)
    if (blockPath && resolved.newText) {
      flashResultText(editor, blockPath, resolved.newText, 'accepted');
    }

    return true;
  } catch (err) {
    console.error('Failed to accept suggestion:', err);
    return false;
  }
}

/**
 * Reject a suggestion: remove the suggestion marks and restore original text.
 * Shows a 3-second flash highlight on the restored text.
 */
export function applySuggestionReject(
  editor: SlateEditor,
  suggestionId: string,
): boolean {
  const resolved = buildResolvedSuggestion(editor, suggestionId);
  if (!resolved) return false;

  // Capture block path before the operation mutates the tree
  const blockPath = getSuggestionBlockPath(editor, suggestionId);

  try {
    plateRejectSuggestion(editor, resolved);
    useAnnotationStore.getState().rejectSuggestion(suggestionId);

    // Flash the restored text (text = the original deleted text that was kept)
    if (blockPath && resolved.text) {
      flashResultText(editor, blockPath, resolved.text, 'rejected');
    }

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
