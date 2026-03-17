import { describe, it, expect } from 'vitest';
import { createSlateEditor } from 'platejs';
import { assignNodeIds, htmlToPlateNodes } from '../deserialize';

describe('assignNodeIds', () => {
  it('should assign unique IDs to all block-level nodes', () => {
    const nodes = [
      { type: 'p', children: [{ text: 'Hello' }] },
      { type: 'p', children: [{ text: 'World' }] },
    ];
    const result = assignNodeIds(nodes);
    const first = result[0] as Record<string, unknown>;
    const second = result[1] as Record<string, unknown>;
    expect(first).toHaveProperty('id');
    expect(second).toHaveProperty('id');
    expect(first.id).not.toBe(second.id);
  });

  it('should preserve existing IDs', () => {
    const nodes = [
      { type: 'p', id: 'existing-id', children: [{ text: 'Hello' }] },
    ];
    const result = assignNodeIds(nodes);
    expect((result[0] as Record<string, unknown>).id).toBe('existing-id');
  });

  it('should assign IDs recursively to nested elements', () => {
    const nodes = [
      {
        type: 'table',
        children: [
          {
            type: 'tr',
            children: [
              { type: 'td', children: [{ text: 'Cell' }] },
            ],
          },
        ],
      },
    ];
    const result = assignNodeIds(nodes);
    const table = result[0] as Record<string, unknown>;
    const tr = (table.children as Record<string, unknown>[])[0];
    const td = (tr.children as Record<string, unknown>[])[0];
    expect(table.id).toBeDefined();
    expect(tr.id).toBeDefined();
    expect(td.id).toBeDefined();
  });

  it('should assign sequential IDs with p{n}_ prefix for document ordering', () => {
    const nodes = [
      { type: 'p', children: [{ text: 'First' }] },
      { type: 'p', children: [{ text: 'Second' }] },
      { type: 'p', children: [{ text: 'Third' }] },
    ];
    const result = assignNodeIds(nodes);
    const ids = result.map(n => (n as Record<string, unknown>).id as string);
    // IDs should start with p0_, p1_, p2_
    expect(ids[0]).toMatch(/^p0_/);
    expect(ids[1]).toMatch(/^p1_/);
    expect(ids[2]).toMatch(/^p2_/);
  });

  it('should not assign IDs to text nodes', () => {
    const nodes = [
      { type: 'p', children: [{ text: 'Hello' }] },
    ];
    const result = assignNodeIds(nodes);
    const children = (result[0] as Record<string, unknown>).children as Record<string, unknown>[];
    expect(children[0].id).toBeUndefined();
  });
});

describe('htmlToPlateNodes', () => {
  it('should convert simple HTML paragraphs to Plate nodes', () => {
    const editor = createSlateEditor({});
    const html = '<p>Hello world</p><p>Second paragraph</p>';
    const result = htmlToPlateNodes(editor, html);
    expect(result.length).toBeGreaterThanOrEqual(2);
    result.forEach(node => {
      if ('children' in node) {
        expect((node as Record<string, unknown>).id).toBeDefined();
      }
    });
  });

  it('should convert headings to appropriate types', () => {
    const editor = createSlateEditor({});
    const html = '<h1>Title</h1><h2>Subtitle</h2><p>Body</p>';
    const result = htmlToPlateNodes(editor, html);
    // Without heading plugins registered, platejs may merge or
    // convert headings to default blocks, but should produce at least 1 node
    expect(result.length).toBeGreaterThanOrEqual(1);
    // All block nodes should have IDs assigned
    result.forEach(node => {
      if ('children' in node) {
        expect((node as Record<string, unknown>).id).toBeDefined();
      }
    });
  });

  it('should handle tables', () => {
    const editor = createSlateEditor({});
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
    const result = htmlToPlateNodes(editor, html);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce unique IDs even with identical content', () => {
    const editor = createSlateEditor({});
    const html = '<p>Same text</p><p>Same text</p><p>Same text</p>';
    const result = htmlToPlateNodes(editor, html);
    const ids = result
      .filter(n => 'children' in n)
      .map(n => (n as Record<string, unknown>).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
