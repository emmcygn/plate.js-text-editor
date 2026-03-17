import {
  type Descendant,
  type SlateEditor,
  deserializeHtml,
  nanoid,
} from 'platejs';

/** Type guard: returns true for block-level nodes (elements with children). */
function isBlock(node: Descendant): node is Descendant & { children: Descendant[] } {
  return 'children' in node;
}

/**
 * Recursively assigns unique IDs to all block-level nodes that lack one.
 * IDs use the format `p${counter}_${nanoid(6)}` where the counter provides
 * meaningful document-order sorting and the nanoid suffix ensures uniqueness.
 */
export function assignNodeIds(nodes: Descendant[]): Descendant[] {
  let counter = 0;

  function walk(children: Descendant[]): Descendant[] {
    return children.map((node) => {
      if (isBlock(node)) {
        const existing = (node as Record<string, unknown>).id;
        const id = typeof existing === 'string' && existing.length > 0
          ? existing
          : `p${counter++}_${nanoid(6)}`;

        return {
          ...node,
          id,
          children: walk(node.children),
        };
      }

      return node;
    });
  }

  return walk(nodes);
}

/**
 * Converts an HTML string into Plate-compatible Descendant nodes
 * with unique IDs on every block element.
 */
export function htmlToPlateNodes(
  editor: SlateEditor,
  html: string
): Descendant[] {
  const fragment = deserializeHtml(editor, { element: html });

  return assignNodeIds(fragment);
}
