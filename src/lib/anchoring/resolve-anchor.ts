import type { SlateEditor, Path, TRange } from 'platejs';
import type { Anchor } from '@/types/annotations';
import { fuzzyFindInText, scoreContext } from './fuzzy-find';
import { offsetToSlateRange } from './offset-to-range';
import { getBlockText } from './create-anchor';

interface TextBlock {
  text: string;
  path: Path;
}

/**
 * Recursively collect all leaf-level block nodes (blocks whose children
 * are text nodes, not other blocks) from the editor tree.
 */
function getAllTextBlocks(editor: SlateEditor): TextBlock[] {
  const blocks: TextBlock[] = [];

  function walk(
    children: ReadonlyArray<unknown>,
    parentPath: Path,
  ): void {
    for (let i = 0; i < children.length; i++) {
      const node = children[i] as {
        text?: string;
        children?: unknown[];
      };
      const path = [...parentPath, i];

      // Text node (leaf) — skip, we care about their parent blocks
      if (typeof node.text === 'string') continue;

      // Block node with children
      if (Array.isArray(node.children)) {
        const hasTextChildren = node.children.some(
          (c) => typeof (c as { text?: string }).text === 'string',
        );

        if (hasTextChildren) {
          // This is a leaf block — collect it
          const text = getBlockText(editor, path);
          if (text.length > 0) {
            blocks.push({ text, path });
          }
        } else {
          // Only recurse if this block has NO direct text children
          // (avoids double-collecting blocks that have both text and block children)
          walk(node.children, path);
        }
      }
    }
  }

  walk(editor.children, []);
  return blocks;
}

/**
 * Find a node by its `id` property anywhere in the editor tree.
 * Returns [node, path] or null.
 */
function findNodeById(
  editor: SlateEditor,
  id: string,
): [unknown & { id?: string; children?: unknown[] }, Path] | null {
  function search(
    children: ReadonlyArray<unknown>,
    parentPath: Path,
  ): [unknown & { id?: string; children?: unknown[] }, Path] | null {
    for (let i = 0; i < children.length; i++) {
      const node = children[i] as {
        id?: string;
        text?: string;
        children?: unknown[];
      };
      const path = [...parentPath, i];

      if (node.id === id) {
        return [node, path];
      }

      if (Array.isArray(node.children)) {
        const found = search(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  return search(editor.children, []);
}

/**
 * Resolve an Anchor to a Slate TRange using a three-tier strategy:
 *
 * 1. **Exact match**: Find paragraph by ID, check text at stored offsets.
 *    If `text.slice(start, end) === anchor.exact`, return immediately.
 *
 * 2. **Fuzzy match**: Same paragraph found by ID, but text has shifted.
 *    Use `fuzzyFindInText` with prefix/suffix context to locate the text.
 *
 * 3. **Full fallback**: Paragraph not found (deleted/rewritten). Search
 *    the entire document for the best context-scored match.
 *
 * Returns null if the anchor cannot be resolved at any tier.
 */
// TODO: For collaborative editing, switch from absolute paragraph IDs to Yjs relative positions.
export function resolveAnchor(
  editor: SlateEditor,
  anchor: Anchor,
): TRange | null {
  const { paragraphId, startOffset, endOffset, exact, prefix, suffix } =
    anchor;

  if (exact.length === 0) return null;

  // --- Tier 1 + 2: Find paragraph by ID ---
  const entry = findNodeById(editor, paragraphId);

  if (entry) {
    const [, path] = entry;
    const text = getBlockText(editor, path);

    // Tier 1: Exact match at stored offsets
    if (text.slice(startOffset, endOffset) === exact) {
      return offsetToSlateRange(editor, path, startOffset, endOffset);
    }

    // Tier 2: Fuzzy match within the same paragraph
    const fuzzyIdx = fuzzyFindInText(text, exact, prefix, suffix);
    if (fuzzyIdx >= 0) {
      return offsetToSlateRange(
        editor,
        path,
        fuzzyIdx,
        fuzzyIdx + exact.length,
      );
    }
  }

  // --- Tier 3: Full document fallback ---
  // Search ALL blocks (including the one from Tier 1/2 — it might contain
  // the text at a position fuzzyFindInText missed due to offsetToSlateRange failure).
  // Note: Mock review items use `__unresolved__` paragraph IDs intentionally to
  // exercise this Tier 3 path. Their 64-char prefix/suffix context provides
  // reliable disambiguation even for highly repeated phrases like "the Company".
  const allBlocks = getAllTextBlocks(editor);

  let bestIdx = -1;
  let bestScore = 0;
  let bestBlock: TextBlock | null = null;

  for (const block of allBlocks) {
    const indices = findAllIndices(block.text, exact);
    for (const idx of indices) {
      const score = scoreContext(
        block.text,
        idx,
        exact.length,
        prefix,
        suffix,
      );
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
        bestBlock = block;
      }
    }
  }

  if (bestBlock && bestIdx >= 0 && bestScore > 0) {
    return offsetToSlateRange(
      editor,
      bestBlock.path,
      bestIdx,
      bestIdx + exact.length,
    );
  }

  return null;
}

/** Find all indices of `needle` in `haystack`. */
function findAllIndices(haystack: string, needle: string): number[] {
  const indices: number[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    indices.push(idx);
    from = idx + 1;
  }
  return indices;
}
