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
 * Detect paragraphs between the "INDEX OF DEFINED TERMS" heading and
 * the next heading, and mark them as index entries for two-column rendering.
 */
function markIndexEntries(nodes: Descendant[]): Descendant[] {
  let inIndex = false;

  return nodes.map((node) => {
    const n = node as Record<string, unknown>;

    // Check for heading-level elements
    if (n.type === 'h1' || n.type === 'h2') {
      const text = extractText(node);
      inIndex = /INDEX OF DEFINED TERMS/i.test(text);
      return node;
    }

    // Any heading ends the index section
    if (typeof n.type === 'string' && /^h[1-6]$/.test(n.type)) {
      inIndex = false;
      return node;
    }

    if (inIndex && n.type === 'p') {
      return { ...node, indexEntry: true };
    }

    return node;
  });
}

/** Extract plain text from a Slate node tree. */
function extractText(node: Descendant): string {
  if ('text' in node) return (node as { text: string }).text;
  if ('children' in node) {
    return (node as { children: Descendant[] }).children.map(extractText).join('');
  }
  return '';
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

  return assignNodeIds(markIndexEntries(fragment));
}
