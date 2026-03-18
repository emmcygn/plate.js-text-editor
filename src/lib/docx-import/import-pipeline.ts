import mammoth from 'mammoth';

const STYLE_MAP = [
  "p[style-name='V14 Level 1 EN CAPS'] => h1:fresh",
  "p[style-name='V14 Level 1 EN'] => h2:fresh",
  "p[style-name='V14 Level 2 EN'] => h3:fresh",
  "p[style-name='V14 Level 3 EN'] => h4:fresh",
  "p[style-name='V14 Level 4 EN'] => h5:fresh",
  "p[style-name='V14 Introduction EN'] => p:fresh",
  "p[style-name='V14 Parties EN'] => p:fresh",
  "p[style-name='V14 TOC 1 EN'] => p.toc-1:fresh",
  "p[style-name='V14 TOC 2 EN'] => p.toc-2:fresh",
  "p[style-name='V14 TOC 3 EN'] => p.toc-3:fresh",
  "p[style-name='V14 TOC Heading EN'] => h1:fresh",
  "p[style-name='TOC Heading'] => h1:fresh",
  // Index entries — mapped with class for page number stripping
  "p[style-name='index 1'] => p.index-entry:fresh",
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
 * Strip trailing page numbers from TOC and index entries.
 * Page numbers reference Word's paginated layout and are meaningless
 * in a web editor — displaying them would be misleading.
 *
 * Handles two patterns:
 * - TOC: <p class="toc-1"><a href="#_Toc...">PARTIES\t5</a></p>
 * - Index: <p class="index-entry">20VC 6</p>
 */
function stripPageReferences(html: string): string {
  // TOC entries — strip anchor links and trailing tab + page number
  let result = html.replace(
    /<p class="toc-\d+">([\s\S]*?)<\/p>/g,
    (_match, inner: string) => {
      let text = inner.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '');
      text = text.replace(/\t\d+\s*$/, '');
      text = text.replace(/[\s.]+\d+\s*$/, '');
      text = text.replace(/\t/g, '\u2003');
      text = text.trim();
      if (!text) return '';
      return `<p>${text}</p>`;
    },
  );

  // Index entries — strip trailing page number, wrap in container for 2-column CSS
  // Insert opening marker before first index entry, closing marker after last
  result = result.replace(
    /<p class="index-entry">([\s\S]*?)<\/p>/g,
    (_match, inner: string) => {
      let text = inner.replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '');
      text = text.replace(/\s+\d+\s*$/, '');
      text = text.trim();
      if (!text) return '';
      return `<p>${text}</p>`;
    },
  );

  return result;
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
    html: stripPageReferences(result.value),
    warnings: result.messages.map((m) => m.message),
  };
}
