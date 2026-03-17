import mammoth from 'mammoth';

const STYLE_MAP = [
  "p[style-name='V14 Level 1 EN CAPS'] => h1:fresh",
  "p[style-name='V14 Level 1 EN'] => h2:fresh",
  "p[style-name='V14 Level 2 EN'] => h3:fresh",
  "p[style-name='V14 Level 3 EN'] => h4:fresh",
  "p[style-name='V14 Level 4 EN'] => h5:fresh",
  // V14 Introduction EN and V14 Parties EN are intentionally unmapped —
  // letting Mammoth's default list detection handle their Word numbering
  // (e.g., (1), (2), (3) and (A), (B) clause markers).
  "p[style-name='V14 TOC 1 EN'] => p.toc-1:fresh",
  "p[style-name='V14 TOC 2 EN'] => p.toc-2:fresh",
  "p[style-name='V14 TOC 3 EN'] => p.toc-3:fresh",
  "p[style-name='V14 TOC Heading EN'] => h2:fresh",
  "p[style-name='TOC Heading'] => h2:fresh",
  // Standard Word heading styles — ensures any DOCX renders with heading hierarchy
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='toc 1'] => p.toc-1:fresh",
  "p[style-name='toc 2'] => p.toc-2:fresh",
  "p[style-name='toc 3'] => p.toc-3:fresh",
];

/**
 * Strip trailing page numbers and TOC anchor links from TOC entries.
 * Page numbers reference Word's paginated layout and are meaningless
 * in a web editor — displaying them would be misleading.
 *
 * Mammoth outputs TOC entries as:
 *   <p class="toc-1"><a href="#_Toc...">PARTIES\t5</a></p>
 *   <p class="toc-2"><a href="#_Toc...">1\tEmployee Incentive Scheme\t10</a></p>
 */
function stripTocPageNumbers(html: string): string {
  return html.replace(
    /<p class="toc-\d+">([\s\S]*?)<\/p>/g,
    (_match, inner: string) => {
      // Strip anchor tags, keep inner text
      let text = inner.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '');
      // Strip trailing tab + page number
      text = text.replace(/\t\d+\s*$/, '');
      // Strip trailing dots + page number (some Word versions)
      text = text.replace(/[\s.]+\d+\s*$/, '');
      // Clean up remaining tabs (used as separators in numbered TOC entries like "1\tTitle")
      text = text.replace(/\t/g, '\u2003');
      text = text.trim();
      if (!text) return '';
      return `<p>${text}</p>`;
    },
  );
}

/**
 * Annotate list items with data attributes that Plate's ListPlugin needs.
 * Mammoth outputs clean `<ol><li>` / `<ul><li>` but Plate's indent-based
 * list model requires `data-list-style-type` and `data-indent` on `<li>`.
 */
function annotateListItems(html: string): string {
  // Use DOMParser to traverse and annotate
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

  doc.querySelectorAll('li').forEach((li) => {
    const parent = li.parentElement;
    if (!parent) return;

    // Determine list style type from parent
    if (parent.tagName === 'OL') {
      li.dataset.listStyleType = parent.style.listStyleType || 'decimal';
    } else if (parent.tagName === 'UL') {
      li.dataset.listStyleType = parent.style.listStyleType || 'disc';
    }

    // Calculate nesting depth
    let depth = 0;
    let el: Element | null = parent;
    while (el) {
      if (el.tagName === 'OL' || el.tagName === 'UL') depth++;
      el = el.parentElement;
    }
    li.dataset.indent = String(depth);
  });

  return doc.body.innerHTML;
}

export interface ImportResult {
  html: string;
  warnings: string[];
}

export async function convertDocxToHtml(
  arrayBuffer: ArrayBuffer
): Promise<ImportResult> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    { styleMap: STYLE_MAP }
  );

  return {
    html: annotateListItems(stripTocPageNumbers(result.value)),
    warnings: result.messages.map((m) => m.message),
  };
}
