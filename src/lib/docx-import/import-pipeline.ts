import mammoth from 'mammoth';

const STYLE_MAP = [
  "p[style-name='V14 Level 1 EN CAPS'] => h1:fresh",
  "p[style-name='V14 Level 1 EN'] => h2:fresh",
  "p[style-name='V14 Level 2 EN'] => h3:fresh",
  "p[style-name='V14 Level 3 EN'] => h4:fresh",
  "p[style-name='V14 Level 4 EN'] => h5:fresh",
  "p[style-name='V14 Introduction EN'] => p:fresh",
  "p[style-name='V14 Parties EN'] => p:fresh",
  "p[style-name='V14 TOC 1 EN'] => p:fresh",
  "p[style-name='V14 TOC 2 EN'] => p:fresh",
  "p[style-name='V14 TOC 3 EN'] => p:fresh",
  "p[style-name='V14 TOC Heading EN'] => h2:fresh",
  "p[style-name='TOC Heading'] => h2:fresh",
  "p[style-name='toc 1'] => p:fresh",
  "p[style-name='toc 2'] => p:fresh",
  "p[style-name='toc 3'] => p:fresh",
];

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
    html: result.value,
    warnings: result.messages.map((m) => m.message),
  };
}
