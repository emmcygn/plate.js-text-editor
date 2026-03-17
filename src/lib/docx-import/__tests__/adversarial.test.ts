import { describe, it, expect } from 'vitest';
import { createSlateEditor } from 'platejs';
import { assignNodeIds, htmlToPlateNodes } from '../deserialize';

describe('DOCX Import — adversarial', () => {
  it('should handle empty HTML string', () => {
    const editor = createSlateEditor({});
    const result = htmlToPlateNodes(editor, '');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle HTML with only whitespace', () => {
    const editor = createSlateEditor({});
    const result = htmlToPlateNodes(editor, '   \n\t  ');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle empty paragraph elements', () => {
    const editor = createSlateEditor({});
    const html = '<p></p><p>Content</p><p></p>';
    const result = htmlToPlateNodes(editor, html);
    result.forEach(node => {
      if ('children' in node) {
        expect((node as Record<string, unknown>).id).toBeDefined();
      }
    });
  });

  it('should not produce duplicate IDs even with hundreds of nodes', () => {
    const paragraphs = Array.from({ length: 500 }, (_, i) => `<p>Paragraph ${i}</p>`).join('');
    const editor = createSlateEditor({});
    const result = htmlToPlateNodes(editor, paragraphs);
    const ids = result
      .filter(n => 'children' in n)
      .map(n => (n as Record<string, unknown>).id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toHaveLength(0);
  });

  it('should handle deeply nested HTML without stack overflow', () => {
    let html = 'deep content';
    for (let i = 0; i < 10; i++) {
      html = `<div>${html}</div>`;
    }
    const editor = createSlateEditor({});
    expect(() => htmlToPlateNodes(editor, html)).not.toThrow();
  });

  it('should handle HTML with special characters', () => {
    const editor = createSlateEditor({});
    const html = '<p>Price: $1,000,000 &amp; "quotes" &lt;tags&gt;</p>';
    const result = htmlToPlateNodes(editor, html);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle assignNodeIds with empty array', () => {
    const result = assignNodeIds([]);
    expect(result).toEqual([]);
  });

  it('should handle malformed HTML gracefully', () => {
    const editor = createSlateEditor({});
    const html = '<p>Unclosed paragraph<p>Another<b>Bold unclosed';
    expect(() => htmlToPlateNodes(editor, html)).not.toThrow();
  });
});
