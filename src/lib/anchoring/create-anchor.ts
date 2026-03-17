import type { SlateEditor, TRange, Path } from 'platejs';
import type { Anchor } from '@/types/annotations';
import { slatePointToOffset } from './offset-to-range';

const CONTEXT_LENGTH = 64;

interface SlateNode {
  text?: string;
  id?: string;
  type?: string;
  children?: SlateNode[];
}

/**
 * Extract the full plain text of a block node by recursively concatenating
 * all text node descendants (handles inline elements like links).
 */
export function getBlockText(
  editor: SlateEditor,
  blockPath: Path,
): string {
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  const entry = editor.node(blockPath) as [SlateNode, Path] | undefined;
  if (!entry) return '';

  const [block] = entry;
  return collectText(block as SlateNode);
}

/** Recursively collect text from a node and all its descendants. */
function collectText(node: SlateNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.children)) return '';

  let result = '';
  for (const child of node.children) {
    result += collectText(child);
  }
  return result;
}

/**
 * Find the nearest block-level ancestor of a point that has an ID.
 * Walks up from the text leaf until it finds a block with an `id` property.
 * Returns [node, path] or null.
 */
function findBlock(
  editor: SlateEditor,
  at: { path: Path; offset: number },
): [SlateNode, Path] | null {
  // Start from the parent of the text leaf, walk up until we find a block with an ID
  let candidatePath = at.path.slice(0, -1);

  while (candidatePath.length > 0) {
    // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
    const entry = editor.node(candidatePath) as [SlateNode, Path] | undefined;
    if (!entry) return null;

    const node = entry[0] as SlateNode;
    if (typeof node.id === 'string' && node.id.length > 0) {
      return [node, candidatePath];
    }

    // Walk up one level
    candidatePath = candidatePath.slice(0, -1);
  }

  return null;
}

/**
 * Create an Anchor from an editor range (typically the current selection).
 *
 * Captures:
 * - paragraphId: the block node's unique ID
 * - startOffset/endOffset: plain-text character offsets within the block
 * - exact: the selected text
 * - prefix: up to 64 characters before the selection
 * - suffix: up to 64 characters after the selection
 *
 * Returns null if:
 * - The range spans multiple blocks
 * - The block has no ID
 * - The range is collapsed (no text selected)
 */
export function createAnchor(
  editor: SlateEditor,
  range: TRange,
): Anchor | null {
  // Find block for anchor and focus
  const anchorBlock = findBlock(editor, range.anchor);
  const focusBlock = findBlock(editor, range.focus);

  if (!anchorBlock || !focusBlock) return null;

  const [anchorNode, anchorPath] = anchorBlock;
  const [, focusPath] = focusBlock;

  // Reject cross-block selections
  if (
    anchorPath.length !== focusPath.length ||
    !anchorPath.every((v, i) => v === focusPath[i])
  ) {
    return null;
  }

  const paragraphId = anchorNode.id;
  if (!paragraphId) return null;

  // Calculate plain-text offsets
  const rawStart = slatePointToOffset(editor, anchorPath, range.anchor);
  const rawEnd = slatePointToOffset(editor, anchorPath, range.focus);

  // Normalize direction (selection could be backwards)
  const startOffset = Math.min(rawStart, rawEnd);
  const endOffset = Math.max(rawStart, rawEnd);

  // Reject collapsed selections
  if (startOffset === endOffset) return null;

  // Get full paragraph text
  const fullText = getBlockText(editor, anchorPath);

  const exact = fullText.slice(startOffset, endOffset);
  const prefix = fullText.slice(
    Math.max(0, startOffset - CONTEXT_LENGTH),
    startOffset,
  );
  const suffix = fullText.slice(endOffset, endOffset + CONTEXT_LENGTH);

  return {
    paragraphId,
    startOffset,
    endOffset,
    exact,
    prefix,
    suffix,
  };
}
