import type { SlateEditor, Path, TRange } from 'platejs';

interface SlateNode {
  text?: string;
  children?: SlateNode[];
}

/**
 * Collect all text leaf nodes from a block, flattening through inline elements.
 * Returns an array of { path, length } for each text leaf in document order.
 */
function collectTextLeaves(
  node: SlateNode,
  nodePath: Path,
): Array<{ path: Path; length: number }> {
  if (typeof node.text === 'string') {
    return [{ path: nodePath, length: node.text.length }];
  }

  if (!Array.isArray(node.children)) return [];

  const leaves: Array<{ path: Path; length: number }> = [];
  for (let i = 0; i < node.children.length; i++) {
    const childLeaves = collectTextLeaves(
      node.children[i],
      [...nodePath, i],
    );
    leaves.push(...childLeaves);
  }
  return leaves;
}

/**
 * Convert plain-text character offsets within a block node to a Slate TRange.
 *
 * Walks all text leaf descendants of the block at `blockPath` (including those
 * nested inside inline elements like links), accumulating character counts to
 * map plain-text offsets → Slate Points (path + offset).
 *
 * Returns null if offsets are out of bounds or the block has no text leaves.
 */
export function offsetToSlateRange(
  editor: SlateEditor,
  blockPath: Path,
  startOffset: number,
  endOffset: number,
): TRange | null {
  if (startOffset < 0 || endOffset < startOffset) return null;

  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  const blockEntry = editor.node(blockPath) as [SlateNode, Path] | undefined;
  if (!blockEntry) return null;

  const [block] = blockEntry;
  const leaves = collectTextLeaves(block as SlateNode, blockPath);

  if (leaves.length === 0) return null;

  let charCount = 0;
  let anchor: { path: Path; offset: number } | null = null;
  let focus: { path: Path; offset: number } | null = null;

  for (const leaf of leaves) {
    const nodeStart = charCount;
    const nodeEnd = charCount + leaf.length;

    // Find anchor point
    if (anchor === null && nodeEnd > startOffset) {
      anchor = {
        path: leaf.path,
        offset: startOffset - nodeStart,
      };
    }

    // Find focus point
    if (focus === null && nodeEnd >= endOffset) {
      focus = {
        path: leaf.path,
        offset: endOffset - nodeStart,
      };
    }

    charCount = nodeEnd;

    if (anchor !== null && focus !== null) break;
  }

  if (anchor === null || focus === null) return null;

  return { anchor, focus };
}

/**
 * Convert a Slate Point to a plain-text character offset within a block.
 * The reverse of offsetToSlateRange's anchor/focus calculation.
 *
 * Handles inline elements by walking all text leaf descendants.
 */
export function slatePointToOffset(
  editor: SlateEditor,
  blockPath: Path,
  point: { path: Path; offset: number },
): number {
  // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
  const blockEntry = editor.node(blockPath) as [SlateNode, Path] | undefined;
  if (!blockEntry) return 0;

  const [block] = blockEntry;
  const leaves = collectTextLeaves(block as SlateNode, blockPath);

  let charCount = 0;

  for (const leaf of leaves) {
    // Check if this is the text node containing our point
    if (
      leaf.path.length === point.path.length &&
      leaf.path.every((v, j) => v === point.path[j])
    ) {
      return charCount + point.offset;
    }

    charCount += leaf.length;
  }

  return charCount;
}
