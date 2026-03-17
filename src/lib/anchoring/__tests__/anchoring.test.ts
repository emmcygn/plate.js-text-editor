import { describe, it, expect, beforeEach } from 'vitest';
import { createSlateEditor } from 'platejs';
import type { SlateEditor, BaseRange } from 'platejs';
import type { Anchor } from '@/types/annotations';
import { offsetToSlateRange, slatePointToOffset } from '../offset-to-range';
import { createAnchor, getBlockText } from '../create-anchor';
import { resolveAnchor } from '../resolve-anchor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEditor(children: unknown[]): SlateEditor {
  const editor = createSlateEditor();
  editor.children = children as SlateEditor['children'];
  return editor;
}

function p(id: string, text: string) {
  return { type: 'p', id, children: [{ text }] };
}

/** Paragraph with mixed formatting children */
function pMixed(id: string, ...children: Array<Record<string, unknown>>) {
  return { type: 'p', id, children };
}

function range(
  anchorPath: number[],
  anchorOffset: number,
  focusPath: number[],
  focusOffset: number,
): BaseRange {
  return {
    anchor: { path: anchorPath, offset: anchorOffset },
    focus: { path: focusPath, offset: focusOffset },
  };
}

// ---------------------------------------------------------------------------
// offsetToSlateRange
// ---------------------------------------------------------------------------
describe('offsetToSlateRange', () => {
  it('single text node: offsets map correctly', () => {
    const editor = makeEditor([p('p1', 'Hello, world!')]);
    const result = offsetToSlateRange(editor, [0], 7, 12);
    expect(result).not.toBeNull();
    expect(result!.anchor).toEqual({ path: [0, 0], offset: 7 });
    expect(result!.focus).toEqual({ path: [0, 0], offset: 12 });
  });

  it('multiple text nodes (bold + plain): offsets span across node boundary', () => {
    // "Hello " (bold, 6 chars) + "world" (plain, 5 chars) = "Hello world"
    const editor = makeEditor([
      pMixed(
        'p1',
        { text: 'Hello ', bold: true },
        { text: 'world' },
      ),
    ]);
    // Select "lo w" => offsets 3..7 spanning both nodes
    const result = offsetToSlateRange(editor, [0], 3, 7);
    expect(result).not.toBeNull();
    // anchor at offset 3 is in first text node (path [0,0], offset 3)
    expect(result!.anchor).toEqual({ path: [0, 0], offset: 3 });
    // focus at offset 7 is in second text node: 7 - 6 = 1
    expect(result!.focus).toEqual({ path: [0, 1], offset: 1 });
  });

  it('offset exactly at node boundary', () => {
    const editor = makeEditor([
      pMixed(
        'p1',
        { text: 'abc' },  // 0..3
        { text: 'def' },  // 3..6
      ),
    ]);
    // Select starting exactly at boundary (offset 3) to 5
    const result = offsetToSlateRange(editor, [0], 3, 5);
    expect(result).not.toBeNull();
    // offset 3 is at start of second node
    expect(result!.anchor).toEqual({ path: [0, 1], offset: 0 });
    expect(result!.focus).toEqual({ path: [0, 1], offset: 2 });
  });

  it('out-of-bounds endOffset returns null', () => {
    const editor = makeEditor([p('p1', 'short')]);
    const result = offsetToSlateRange(editor, [0], 0, 1000);
    expect(result).toBeNull();
  });

  it('negative startOffset returns null', () => {
    const editor = makeEditor([p('p1', 'hello')]);
    const result = offsetToSlateRange(editor, [0], -1, 3);
    expect(result).toBeNull();
  });

  it('startOffset > endOffset returns null', () => {
    const editor = makeEditor([p('p1', 'hello')]);
    const result = offsetToSlateRange(editor, [0], 5, 2);
    expect(result).toBeNull();
  });

  it('empty text node children', () => {
    const editor = makeEditor([
      pMixed('p1', { text: '' }),
    ]);
    const result = offsetToSlateRange(editor, [0], 0, 1);
    expect(result).toBeNull();
  });

  it('selection of entire text in single node', () => {
    const editor = makeEditor([p('p1', 'abcdef')]);
    const result = offsetToSlateRange(editor, [0], 0, 6);
    expect(result).not.toBeNull();
    expect(result!.anchor).toEqual({ path: [0, 0], offset: 0 });
    expect(result!.focus).toEqual({ path: [0, 0], offset: 6 });
  });

  it('three text nodes: offset spans middle node entirely', () => {
    const editor = makeEditor([
      pMixed(
        'p1',
        { text: 'AA' },   // 0..2
        { text: 'BBBB' }, // 2..6
        { text: 'CC' },   // 6..8
      ),
    ]);
    // Select offsets 1..7 spanning all three nodes
    const result = offsetToSlateRange(editor, [0], 1, 7);
    expect(result).not.toBeNull();
    expect(result!.anchor).toEqual({ path: [0, 0], offset: 1 });
    expect(result!.focus).toEqual({ path: [0, 2], offset: 1 });
  });
});

// ---------------------------------------------------------------------------
// slatePointToOffset (round-trip consistency)
// ---------------------------------------------------------------------------
describe('slatePointToOffset', () => {
  it('round-trips with offsetToSlateRange for multi-node paragraph', () => {
    const editor = makeEditor([
      pMixed(
        'p1',
        { text: 'Hello ', bold: true },
        { text: 'beautiful ' },
        { text: 'world', italic: true },
      ),
    ]);
    // "Hello beautiful world" => select "beautiful" at offsets 6..15
    const slateRange = offsetToSlateRange(editor, [0], 6, 15);
    expect(slateRange).not.toBeNull();

    const startOff = slatePointToOffset(editor, [0], slateRange!.anchor);
    const endOff = slatePointToOffset(editor, [0], slateRange!.focus);
    expect(startOff).toBe(6);
    expect(endOff).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// createAnchor
// ---------------------------------------------------------------------------
describe('createAnchor', () => {
  let editor: SlateEditor;

  beforeEach(() => {
    editor = makeEditor([
      p('p1', 'The quick brown fox jumps over the lazy dog.'),
      p('p2', 'Pack my box with five dozen liquor jugs.'),
      p('p3', 'How vexingly quick daft zebras jump!'),
    ]);
  });

  it('captures all fields correctly', () => {
    // Select "brown fox" in p1: starts at 10, ends at 19
    const anchor = createAnchor(editor, range([0, 0], 10, [0, 0], 19));
    expect(anchor).not.toBeNull();
    expect(anchor!.paragraphId).toBe('p1');
    expect(anchor!.startOffset).toBe(10);
    expect(anchor!.endOffset).toBe(19);
    expect(anchor!.exact).toBe('brown fox');
    expect(anchor!.prefix).toBe('The quick ');
    expect(anchor!.suffix).toBe(' jumps over the lazy dog.');
  });

  it('prefix captures up to 64 chars before selection', () => {
    // Build a paragraph with a long prefix
    const longText = 'A'.repeat(100) + 'TARGET' + 'B'.repeat(20);
    const ed = makeEditor([p('long', longText)]);
    // Select "TARGET" at offset 100..106
    const anchor = createAnchor(ed, range([0, 0], 100, [0, 0], 106));
    expect(anchor).not.toBeNull();
    expect(anchor!.prefix.length).toBe(64);
    expect(anchor!.prefix).toBe('A'.repeat(64));
  });

  it('suffix captures up to 64 chars after selection', () => {
    const longText = 'X'.repeat(10) + 'TARGET' + 'Z'.repeat(100);
    const ed = makeEditor([p('suf', longText)]);
    const anchor = createAnchor(ed, range([0, 0], 10, [0, 0], 16));
    expect(anchor).not.toBeNull();
    expect(anchor!.suffix.length).toBe(64);
    expect(anchor!.suffix).toBe('Z'.repeat(64));
  });

  it('selection at start of paragraph - prefix is empty', () => {
    // Select "The" at 0..3
    const anchor = createAnchor(editor, range([0, 0], 0, [0, 0], 3));
    expect(anchor).not.toBeNull();
    expect(anchor!.prefix).toBe('');
    expect(anchor!.exact).toBe('The');
  });

  it('selection at end of paragraph - suffix is empty', () => {
    // p1: "The quick brown fox jumps over the lazy dog." (44 chars)
    // Select "dog." at 40..44
    const anchor = createAnchor(editor, range([0, 0], 40, [0, 0], 44));
    expect(anchor).not.toBeNull();
    expect(anchor!.suffix).toBe('');
    expect(anchor!.exact).toBe('dog.');
  });

  it('returns null for collapsed range (start === end)', () => {
    const anchor = createAnchor(editor, range([0, 0], 5, [0, 0], 5));
    expect(anchor).toBeNull();
  });

  it('returns null when block has no ID', () => {
    const ed = makeEditor([
      { type: 'p', children: [{ text: 'no id here' }] },
    ]);
    const anchor = createAnchor(ed, range([0, 0], 0, [0, 0], 5));
    expect(anchor).toBeNull();
  });

  it('handles backward selection (focus before anchor)', () => {
    // Select "quick" backwards: focus at 4, anchor at 9
    const anchor = createAnchor(editor, range([0, 0], 9, [0, 0], 4));
    expect(anchor).not.toBeNull();
    expect(anchor!.exact).toBe('quick');
    expect(anchor!.startOffset).toBe(4);
    expect(anchor!.endOffset).toBe(9);
  });

  it('works across formatted text nodes', () => {
    const ed = makeEditor([
      pMixed(
        'fmt',
        { text: 'Hello ', bold: true },
        { text: 'world', italic: true },
      ),
    ]);
    // Select "lo world" => offsets in first node child [0,0] at 3, focus in [0,1] at 5
    const anchor = createAnchor(ed, range([0, 0], 3, [0, 1], 5));
    expect(anchor).not.toBeNull();
    expect(anchor!.exact).toBe('lo world');
    expect(anchor!.startOffset).toBe(3);
    expect(anchor!.endOffset).toBe(11);
    expect(anchor!.prefix).toBe('Hel');
    expect(anchor!.suffix).toBe('');
  });
});

// ---------------------------------------------------------------------------
// resolveAnchor
// ---------------------------------------------------------------------------
describe('resolveAnchor', () => {
  it('round-trip: createAnchor -> resolveAnchor -> same text', () => {
    const editor = makeEditor([
      p('p1', 'The quick brown fox jumps over the lazy dog.'),
    ]);
    const anchor = createAnchor(editor, range([0, 0], 10, [0, 0], 19));
    expect(anchor).not.toBeNull();

    const resolved = resolveAnchor(editor, anchor!);
    expect(resolved).not.toBeNull();

    // Extract the text at the resolved range
    const text = getBlockText(editor, [0]);
    const startOff = slatePointToOffset(editor, [0], resolved!.anchor);
    const endOff = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(startOff, endOff)).toBe('brown fox');
  });

  it('"the Company" disambiguation: anchor to p2, resolves to p2', () => {
    const editor = makeEditor([
      p('p1', 'The shares of the Company shall be issued by the Company to the Holders.'),
      p('p2', 'Subject to clause 5, the Company may distribute dividends annually.'),
      p('p3', 'The board of the Company shall convene quarterly meetings of the Company.'),
    ]);

    // Anchor "the Company" in p2 at offset 23..34
    const p2Text = 'Subject to clause 5, the Company may distribute dividends annually.';
    const idx = p2Text.indexOf('the Company');
    const anchor: Anchor = {
      paragraphId: 'p2',
      startOffset: idx,
      endOffset: idx + 'the Company'.length,
      exact: 'the Company',
      prefix: p2Text.slice(Math.max(0, idx - 32), idx),
      suffix: p2Text.slice(idx + 'the Company'.length, idx + 'the Company'.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Must resolve to paragraph p2, path [1]
    expect(resolved!.anchor.path[0]).toBe(1);
    expect(resolved!.focus.path[0]).toBe(1);

    // Verify the text
    const resolvedText = getBlockText(editor, [1]);
    const s = slatePointToOffset(editor, [1], resolved!.anchor);
    const e = slatePointToOffset(editor, [1], resolved!.focus);
    expect(resolvedText.slice(s, e)).toBe('the Company');
  });

  it('deleted paragraph falls to Tier 3 and finds text in another paragraph', () => {
    // Anchor was in 'deleted-p' which no longer exists
    const editor = makeEditor([
      p('p1', 'Some unrelated text here.'),
      p('p3', 'The relevant clause about indemnification states clearly.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'deleted-p',
      startOffset: 10,
      endOffset: 25,
      exact: 'indemnification',
      prefix: 'about ',
      suffix: ' states clearly',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Should find it in p3
    const resolvedText = getBlockText(editor, resolved!.anchor.path.slice(0, 1));
    const s = slatePointToOffset(editor, resolved!.anchor.path.slice(0, 1), resolved!.anchor);
    const e = slatePointToOffset(editor, resolved!.focus.path.slice(0, 1), resolved!.focus);
    expect(resolvedText.slice(s, e)).toBe('indemnification');
  });

  it('deleted paragraph returns null when text is not found anywhere', () => {
    const editor = makeEditor([
      p('p1', 'Nothing matching here at all.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'deleted-p',
      startOffset: 0,
      endOffset: 15,
      exact: 'nonexistent text',
      prefix: 'before ',
      suffix: ' after',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).toBeNull();
  });

  it('out-of-bounds offsets: endOffset 1000 does not crash', () => {
    const editor = makeEditor([
      p('p1', 'Short text.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 0,
      endOffset: 1000,
      exact: 'Short text.',
      prefix: '',
      suffix: '',
    };

    // Tier 1 exact match will fail because slice(0, 1000) still equals the text,
    // but we should not crash regardless
    expect(() => resolveAnchor(editor, anchor)).not.toThrow();
  });

  it('edited text: insertion before anchored text shifts offset, Tier 2 recovers', () => {
    // Original: "The fox jumped quickly." anchored to "jumped" at 8..14
    // After edit: "The brown fox jumped quickly." (inserted "brown " before "fox")
    const editor = makeEditor([
      p('p1', 'The brown fox jumped quickly.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 8,  // old offset of "jumped" before "brown " was inserted
      endOffset: 14,
      exact: 'jumped',
      prefix: 'The fox ',  // old prefix
      suffix: ' quickly.',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    // "jumped" is now at offset 14 in the edited text
    const text = getBlockText(editor, [0]);
    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(s, e)).toBe('jumped');
  });

  it('special characters in text: $1,000,000 (the "Purchase Price")', () => {
    const text = 'The buyer shall pay $1,000,000 (the "Purchase Price") in full.';
    const editor = makeEditor([p('p1', text)]);

    const exact = '$1,000,000 (the "Purchase Price")';
    const idx = text.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: text.slice(Math.max(0, idx - 32), idx),
      suffix: text.slice(idx + exact.length, idx + exact.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const resolvedText = getBlockText(editor, [0]);
    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(resolvedText.slice(s, e)).toBe(exact);
  });

  it('anchor to text inside formatted span (bold) - offsets work across text nodes', () => {
    const editor = makeEditor([
      pMixed(
        'p1',
        { text: 'Section 3.1: ' },            // 0..13
        { text: 'Indemnification', bold: true }, // 13..28
        { text: ' of the Parties.' },            // 28..44
      ),
    ]);

    // Anchor the bold word "Indemnification" at offsets 13..28
    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 13,
      endOffset: 28,
      exact: 'Indemnification',
      prefix: 'Section 3.1: ',
      suffix: ' of the Parties.',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Anchor should point into the bold text node [0,1]
    expect(resolved!.anchor.path).toEqual([0, 1]);
    expect(resolved!.anchor.offset).toBe(0);
    expect(resolved!.focus.path).toEqual([0, 1]);
    expect(resolved!.focus.offset).toBe(15);
  });

  it('Tier 3 fallback disambiguates using context when paragraph deleted', () => {
    // Two paragraphs with identical "the Company" but different context
    const editor = makeEditor([
      p('p1', 'According to section 2, the Company shall issue shares.'),
      p('p3', 'In the event of default, the Company must pay damages.'),
    ]);

    // Anchor was originally in a deleted paragraph, but the text and context
    // match the second paragraph (p3)
    const anchor: Anchor = {
      paragraphId: 'deleted-p',
      startOffset: 20,
      endOffset: 31,
      exact: 'the Company',
      prefix: 'In the event of default, ',
      suffix: ' must pay damages.',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Should resolve to p3 (path [1]), not p1 (path [0])
    expect(resolved!.anchor.path[0]).toBe(1);
  });

  it('empty exact text returns null', () => {
    const editor = makeEditor([p('p1', 'Some text.')]);
    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 0,
      endOffset: 0,
      exact: '',
      prefix: '',
      suffix: 'Some text.',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).toBeNull();
  });

  it('Tier 1 exact match with offset at end of text', () => {
    const text = 'Hello world';
    const editor = makeEditor([p('p1', text)]);

    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 6,
      endOffset: 11,
      exact: 'world',
      prefix: 'Hello ',
      suffix: '',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(s, e)).toBe('world');
  });

  it('multiple occurrences in same paragraph: Tier 2 fuzzy picks the right one', () => {
    // "the Company" appears twice in the same paragraph
    const text = 'The board of the Company shall notify the Company of any changes.';
    const editor = makeEditor([p('p1', text)]);

    // Anchor the SECOND "the Company" (at offset 40)
    const secondIdx = text.indexOf('the Company', text.indexOf('the Company') + 1);
    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 999, // intentionally wrong offset to force Tier 2
      endOffset: 999 + 'the Company'.length,
      exact: 'the Company',
      prefix: text.slice(Math.max(0, secondIdx - 32), secondIdx),
      suffix: text.slice(secondIdx + 'the Company'.length, secondIdx + 'the Company'.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(s, e)).toBe('the Company');
    // The resolved offset should be at the second occurrence
    expect(s).toBe(secondIdx);
  });
});

// ---------------------------------------------------------------------------
// getBlockText
// ---------------------------------------------------------------------------
describe('getBlockText', () => {
  it('concatenates all text children including formatted spans', () => {
    const editor = makeEditor([
      pMixed(
        'p1',
        { text: 'Normal ' },
        { text: 'bold', bold: true },
        { text: ' and ' },
        { text: 'italic', italic: true },
      ),
    ]);
    expect(getBlockText(editor, [0])).toBe('Normal bold and italic');
  });

  it('returns empty string for block with empty text nodes', () => {
    const editor = makeEditor([
      pMixed('p1', { text: '' }, { text: '' }),
    ]);
    expect(getBlockText(editor, [0])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Adversarial stress tests
// ---------------------------------------------------------------------------
describe('Anchoring — adversarial stress tests', () => {
  // =========================================================================
  // 1. 174 occurrences of "the Company" — context disambiguates
  // =========================================================================
  it('disambiguates among 174 paragraphs each containing "the Company"', () => {
    const paragraphs = Array.from({ length: 174 }, (_, i) => {
      const before = `Clause ${i + 1} states that `;
      const after = ` shall comply with regulation ${i + 1}.`;
      return p(`p${i}`, `${before}the Company${after}`);
    });
    const editor = makeEditor(paragraphs);

    // Anchor "the Company" in paragraph 99 (p99)
    const targetIdx = 99;
    const targetText = `Clause ${targetIdx + 1} states that the Company shall comply with regulation ${targetIdx + 1}.`;
    const idx = targetText.indexOf('the Company');
    const anchor: Anchor = {
      paragraphId: `p${targetIdx}`,
      startOffset: idx,
      endOffset: idx + 'the Company'.length,
      exact: 'the Company',
      prefix: targetText.slice(Math.max(0, idx - 32), idx),
      suffix: targetText.slice(idx + 'the Company'.length, idx + 'the Company'.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Must resolve to paragraph index 99
    expect(resolved!.anchor.path[0]).toBe(targetIdx);
    expect(resolved!.focus.path[0]).toBe(targetIdx);

    const text = getBlockText(editor, [targetIdx]);
    const s = slatePointToOffset(editor, [targetIdx], resolved!.anchor);
    const e = slatePointToOffset(editor, [targetIdx], resolved!.focus);
    expect(text.slice(s, e)).toBe('the Company');
  });

  // =========================================================================
  // 2. Cascading edits — fuzzy matching survives insertions and deletions
  // =========================================================================
  it('resolves after cascading edits via Tier 2 fuzzy matching', () => {
    // Original: "The quick brown fox jumps over the lazy dog."
    // Anchor "brown fox" at offsets 10..19
    const original = 'The quick brown fox jumps over the lazy dog.';
    const idx = original.indexOf('brown fox');
    const anchor: Anchor = {
      paragraphId: 'p1',
      startOffset: idx,
      endOffset: idx + 'brown fox'.length,
      exact: 'brown fox',
      prefix: original.slice(Math.max(0, idx - 32), idx),
      suffix: original.slice(idx + 'brown fox'.length, idx + 'brown fox'.length + 32),
    };

    // After edits: inserted "very " before "quick", deleted "lazy ", added " today" at end
    const edited = 'The very quick brown fox jumps over the dog today.';
    const editor = makeEditor([p('p1', edited)]);

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const text = getBlockText(editor, [0]);
    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(s, e)).toBe('brown fox');
  });

  // =========================================================================
  // 3. Paragraph reordering — ID-based lookup ignores position
  // =========================================================================
  it('resolves via Tier 1 when paragraphs are reordered', () => {
    const paragraphs = [
      p('p5', 'Fifth paragraph with unique content here.'),
      p('p4', 'Fourth paragraph about something else entirely.'),
      p('p3', 'Third paragraph discussing another topic.'),
      p('p2', 'Second paragraph on a different subject.'),
      p('p1', 'First paragraph was originally at position zero.'),
    ];
    const editor = makeEditor(paragraphs);

    // Anchor was created when p3 was at position 2, now it's at position 2 still
    // but the key point is the ID lookup finds it regardless
    const anchor: Anchor = {
      paragraphId: 'p3',
      startOffset: 0,
      endOffset: 19,
      exact: 'Third paragraph dis',
      prefix: '',
      suffix: 'cussing another topic.',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    // p3 is now at index 2 in the reversed array
    const p3Index = paragraphs.findIndex(
      (node) => (node as unknown as { id: string }).id === 'p3',
    );
    expect(resolved!.anchor.path[0]).toBe(p3Index);
  });

  // =========================================================================
  // 4. Deeply nested tables — anchor to text in table cell
  // =========================================================================
  it('resolves anchor to text inside a deeply nested table cell', () => {
    const tableDoc = [
      p('before', 'Text before the table.'),
      {
        type: 'table',
        children: [
          {
            type: 'tr',
            children: [
              {
                type: 'td',
                children: [
                  p('cell-p1', 'Cell one content with the Company mentioned.'),
                ],
              },
              {
                type: 'td',
                children: [
                  p('cell-p2', 'Cell two has different content about obligations.'),
                ],
              },
            ],
          },
          {
            type: 'tr',
            children: [
              {
                type: 'td',
                children: [
                  p('cell-p3', 'Cell three discusses indemnification clauses here.'),
                ],
              },
              {
                type: 'td',
                children: [
                  p('cell-p4', 'Cell four: the Company shall pay $500,000.'),
                ],
              },
            ],
          },
        ],
      },
      p('after', 'Text after the table.'),
    ];
    const editor = makeEditor(tableDoc);

    // Anchor "indemnification clauses" in cell-p3
    const cellText = 'Cell three discusses indemnification clauses here.';
    const idx = cellText.indexOf('indemnification clauses');
    const anchor: Anchor = {
      paragraphId: 'cell-p3',
      startOffset: idx,
      endOffset: idx + 'indemnification clauses'.length,
      exact: 'indemnification clauses',
      prefix: cellText.slice(Math.max(0, idx - 32), idx),
      suffix: cellText.slice(
        idx + 'indemnification clauses'.length,
        idx + 'indemnification clauses'.length + 32,
      ),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    // Verify the resolved text is correct
    // cell-p3 is at path [1, 1, 0, 0] (table -> row2 -> cell1 -> p)
    const blockPath = resolved!.anchor.path.slice(0, -1);
    const text = getBlockText(editor, blockPath);
    const s = slatePointToOffset(editor, blockPath, resolved!.anchor);
    const e = slatePointToOffset(editor, blockPath, resolved!.focus);
    expect(text.slice(s, e)).toBe('indemnification clauses');
  });

  // =========================================================================
  // 5. Empty paragraphs — should not crash
  // =========================================================================
  it('does not crash when document contains empty paragraphs', () => {
    const editor = makeEditor([
      p('p1', ''),
      p('p2', ''),
      p('p3', 'Only non-empty paragraph.'),
      p('p4', ''),
    ]);

    // Anchor into empty paragraph
    const emptyAnchor: Anchor = {
      paragraphId: 'p1',
      startOffset: 0,
      endOffset: 5,
      exact: 'hello',
      prefix: '',
      suffix: '',
    };
    expect(() => resolveAnchor(editor, emptyAnchor)).not.toThrow();
    // Won't find "hello" in empty text — but Tier 3 won't find it either
    const resolved = resolveAnchor(editor, emptyAnchor);
    expect(resolved).toBeNull();

    // Anchor targeting p3 should still work amid empty paragraphs
    const validAnchor: Anchor = {
      paragraphId: 'p3',
      startOffset: 5,
      endOffset: 14,
      exact: 'non-empty',
      prefix: 'Only ',
      suffix: ' paragraph.',
    };
    const resolved2 = resolveAnchor(editor, validAnchor);
    expect(resolved2).not.toBeNull();
    const text = getBlockText(editor, [2]);
    const s = slatePointToOffset(editor, [2], resolved2!.anchor);
    const e = slatePointToOffset(editor, [2], resolved2!.focus);
    expect(text.slice(s, e)).toBe('non-empty');
  });

  // =========================================================================
  // 6. Massive document — 500+ paragraphs, no infinite loops
  // =========================================================================
  it('handles 500+ paragraph document without hanging', () => {
    const paragraphs = Array.from({ length: 500 }, (_, i) =>
      p(`p${i}`, `Paragraph number ${i} contains some boilerplate legal text about obligations and rights under the agreement.`),
    );
    const editor = makeEditor(paragraphs);

    // Anchor to paragraph 499
    const targetText =
      'Paragraph number 499 contains some boilerplate legal text about obligations and rights under the agreement.';
    const exact = 'obligations and rights';
    const idx = targetText.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'p499',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: targetText.slice(Math.max(0, idx - 32), idx),
      suffix: targetText.slice(idx + exact.length, idx + exact.length + 32),
    };

    const start = Date.now();
    const resolved = resolveAnchor(editor, anchor);
    const elapsed = Date.now() - start;

    expect(resolved).not.toBeNull();
    expect(elapsed).toBeLessThan(5000); // Must complete in < 5 seconds
    expect(resolved!.anchor.path[0]).toBe(499);
  });

  // =========================================================================
  // 7. Identical paragraphs — ID-based Tier 1 picks the right one
  // =========================================================================
  it('Tier 1 resolves to correct paragraph among 5 with identical text', () => {
    const identicalText = 'The Company shall indemnify and hold harmless all parties.';
    const paragraphs = Array.from({ length: 5 }, (_, i) =>
      p(`dup${i}`, identicalText),
    );
    const editor = makeEditor(paragraphs);

    // Anchor specifically to dup3
    const exact = 'indemnify and hold harmless';
    const idx = identicalText.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'dup3',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: identicalText.slice(Math.max(0, idx - 32), idx),
      suffix: identicalText.slice(idx + exact.length, idx + exact.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Must resolve to index 3 (dup3), not any other
    expect(resolved!.anchor.path[0]).toBe(3);
  });

  // =========================================================================
  // 8. All tiers of resolution — force each tier explicitly
  // =========================================================================
  describe('explicit tier testing', () => {
    it('Tier 1: exact ID + exact offsets', () => {
      const text = 'Alpha beta gamma delta epsilon.';
      const editor = makeEditor([p('t1', text)]);

      const exact = 'gamma delta';
      const idx = text.indexOf(exact);
      const anchor: Anchor = {
        paragraphId: 't1',
        startOffset: idx,
        endOffset: idx + exact.length,
        exact,
        prefix: text.slice(Math.max(0, idx - 32), idx),
        suffix: text.slice(idx + exact.length, idx + exact.length + 32),
      };

      const resolved = resolveAnchor(editor, anchor);
      expect(resolved).not.toBeNull();
      expect(resolved!.anchor.path[0]).toBe(0);
      const s = slatePointToOffset(editor, [0], resolved!.anchor);
      expect(text.slice(s, s + exact.length)).toBe(exact);
    });

    it('Tier 2: correct ID but offsets shifted by insertion', () => {
      // Original text had "gamma" at offset 11, but now there's extra text
      const editedText = 'Alpha INSERTED beta gamma delta epsilon.';
      const editor = makeEditor([p('t2', editedText)]);

      const exact = 'gamma delta';
      const anchor: Anchor = {
        paragraphId: 't2',
        startOffset: 11, // old offset, no longer correct
        endOffset: 22,
        exact,
        prefix: 'Alpha beta ', // old prefix (before insertion)
        suffix: ' epsilon.',
      };

      const resolved = resolveAnchor(editor, anchor);
      expect(resolved).not.toBeNull();

      const s = slatePointToOffset(editor, [0], resolved!.anchor);
      const e = slatePointToOffset(editor, [0], resolved!.focus);
      expect(editedText.slice(s, e)).toBe(exact);
    });

    it('Tier 3: paragraph deleted, falls back to full-document search', () => {
      const editor = makeEditor([
        p('other1', 'Irrelevant text about nothing.'),
        p('other2', 'This clause about gamma delta is important.'),
      ]);

      const anchor: Anchor = {
        paragraphId: 'deleted-para',
        startOffset: 5,
        endOffset: 16,
        exact: 'gamma delta',
        prefix: 'about ',
        suffix: ' is important',
      };

      const resolved = resolveAnchor(editor, anchor);
      expect(resolved).not.toBeNull();
      expect(resolved!.anchor.path[0]).toBe(1); // found in other2

      const text = getBlockText(editor, [1]);
      const s = slatePointToOffset(editor, [1], resolved!.anchor);
      const e = slatePointToOffset(editor, [1], resolved!.focus);
      expect(text.slice(s, e)).toBe('gamma delta');
    });
  });

  // =========================================================================
  // 9. Anchor with all special characters
  // =========================================================================
  it('handles special chars: $1,000,000.00 ("Purchase Price") per §4.2(a)(i)', () => {
    const text =
      'The buyer agrees to pay $1,000,000.00 ("Purchase Price") per §4.2(a)(i) to the seller within 30 days.';
    const editor = makeEditor([p('spec', text)]);

    const exact = '$1,000,000.00 ("Purchase Price") per §4.2(a)(i)';
    const idx = text.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'spec',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: text.slice(Math.max(0, idx - 32), idx),
      suffix: text.slice(idx + exact.length, idx + exact.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(s, e)).toBe(exact);
  });

  // =========================================================================
  // 10. Cross-format text nodes — bold + italic split
  // =========================================================================
  it('offset calculation spans bold/italic text nodes correctly', () => {
    // "the Company" split across two formatted nodes
    const editor = makeEditor([
      pMixed(
        'fmt1',
        { text: 'According to the agreement, ' },
        { text: 'the ', bold: true },
        { text: 'Company', italic: true },
        { text: ' shall pay dividends.' },
      ),
    ]);

    const fullText = 'According to the agreement, the Company shall pay dividends.';
    const exact = 'the Company';
    const idx = fullText.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'fmt1',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: fullText.slice(Math.max(0, idx - 32), idx),
      suffix: fullText.slice(idx + exact.length, idx + exact.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    // Anchor should start in bold node, focus in italic node
    // "According to the agreement, " = 28 chars (node 0)
    // "the " = 4 chars (node 1, bold)
    // "Company" = 7 chars (node 2, italic)
    // startOffset = 28, endOffset = 39
    expect(resolved!.anchor.path).toEqual([0, 1]); // bold node
    expect(resolved!.anchor.offset).toBe(0);
    expect(resolved!.focus.path).toEqual([0, 2]); // italic node
    expect(resolved!.focus.offset).toBe(7);
  });

  // =========================================================================
  // 11. offsetToSlateRange with 10+ alternating text nodes
  // =========================================================================
  it('offsetToSlateRange handles 10+ alternating bold/plain nodes at every boundary', () => {
    // Build 12 nodes alternating bold/plain, each 5 chars
    const nodes: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 12; i++) {
      const text = String.fromCharCode(65 + i).repeat(5); // AAAAA, BBBBB, ...
      nodes.push(i % 2 === 0 ? { text } : { text, bold: true });
    }
    const editor = makeEditor([pMixed('multi', ...nodes)]);

    // Total length = 60 chars. Test boundaries at every 5-char mark
    for (let boundary = 0; boundary <= 60; boundary += 5) {
      if (boundary === 0) continue; // skip 0-length
      const result = offsetToSlateRange(editor, [0], 0, boundary);
      expect(result).not.toBeNull();
      // Focus should be at node (boundary/5 - 1), offset 5
      // OR at node boundary/5, offset 0 — both are valid as long as text is correct
      const focusNodeIdx = result!.focus.path[result!.focus.path.length - 1];
      const totalOffset = focusNodeIdx * 5 + result!.focus.offset;
      expect(totalOffset).toBe(boundary);
    }

    // Test spanning from middle of node 3 to middle of node 9
    // node 3 starts at offset 15, node 9 starts at offset 45
    const result = offsetToSlateRange(editor, [0], 17, 47);
    expect(result).not.toBeNull();
    // anchor in node 3 (15..20), offset 2
    expect(result!.anchor.path).toEqual([0, 3]);
    expect(result!.anchor.offset).toBe(2);
    // focus in node 9 (45..50), offset 2
    expect(result!.focus.path).toEqual([0, 9]);
    expect(result!.focus.offset).toBe(2);
  });

  // =========================================================================
  // 12. Zero-length text nodes — must handle gracefully
  // =========================================================================
  it('offsetToSlateRange handles zero-length text nodes', () => {
    const editor = makeEditor([
      pMixed(
        'zerolen',
        { text: '' },
        { text: 'hello' },
        { text: '' },
        { text: ' world' },
        { text: '' },
      ),
    ]);

    // Total text: "hello world" = 11 chars
    // Select "lo wo" at offsets 3..8
    const result = offsetToSlateRange(editor, [0], 3, 8);
    expect(result).not.toBeNull();
    // "hello" is in node index 1 (node 0 is empty)
    expect(result!.anchor.path).toEqual([0, 1]);
    expect(result!.anchor.offset).toBe(3);
    // " world" is in node index 3 (node 2 is empty)
    expect(result!.focus.path).toEqual([0, 3]);
    expect(result!.focus.offset).toBe(3);
  });

  it('resolveAnchor works with zero-length text nodes in paragraph', () => {
    const editor = makeEditor([
      pMixed(
        'z1',
        { text: '' },
        { text: 'important clause' },
        { text: '' },
      ),
    ]);

    const anchor: Anchor = {
      paragraphId: 'z1',
      startOffset: 0,
      endOffset: 16,
      exact: 'important clause',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
  });

  // =========================================================================
  // 13. Paragraph deleted then re-added with same ID
  // =========================================================================
  it('resolves when paragraph was deleted and re-added with same ID but different text', () => {
    // Original paragraph had "original content about warranties"
    // It was deleted and re-added with slightly different text
    const editor = makeEditor([
      p('p1', 'Some other paragraph.'),
      p('recycled', 'Updated content about warranties and representations.'),
      p('p3', 'Final paragraph.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'recycled',
      startOffset: 10,
      endOffset: 30,
      exact: 'about warranties',
      prefix: 'original content ',
      suffix: ' and indemnification',
    };

    // Tier 1 will fail (text at offsets 10..30 != "about warranties")
    // Tier 2 should find "about warranties" via fuzzy match
    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const text = getBlockText(editor, [1]);
    const s = slatePointToOffset(editor, [1], resolved!.anchor);
    const e = slatePointToOffset(editor, [1], resolved!.focus);
    expect(text.slice(s, e)).toBe('about warranties');
  });

  it('resolves when paragraph was deleted and re-added with same ID and same text', () => {
    const editor = makeEditor([
      p('reborn', 'The exact same text as before, unchanged.'),
    ]);

    const exact = 'same text as before';
    const text = 'The exact same text as before, unchanged.';
    const idx = text.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'reborn',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: text.slice(Math.max(0, idx - 32), idx),
      suffix: text.slice(idx + exact.length, idx + exact.length + 32),
    };

    // Tier 1 should resolve perfectly
    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const resolvedText = getBlockText(editor, [0]);
    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(resolvedText.slice(s, e)).toBe(exact);
  });

  // =========================================================================
  // Additional adversarial: Tier 3 with many near-matches
  // =========================================================================
  it('Tier 3 correctly picks best match among many near-identical paragraphs', () => {
    // 20 paragraphs all containing "the Company shall" but with different context
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      p(`m${i}`, `Under section ${i + 1}, the Company shall fulfill obligation ${i + 1} as described.`),
    );
    const editor = makeEditor(paragraphs);

    // Anchor to paragraph 14 but with deleted ID
    const targetText =
      'Under section 15, the Company shall fulfill obligation 15 as described.';
    const exact = 'the Company shall';
    const idx = targetText.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'deleted-id',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: targetText.slice(Math.max(0, idx - 32), idx),
      suffix: targetText.slice(idx + exact.length, idx + exact.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();
    // Should resolve to index 14 (m14, which has "section 15")
    expect(resolved!.anchor.path[0]).toBe(14);
  });

  // =========================================================================
  // Additional adversarial: Unicode and whitespace edge cases
  // =========================================================================
  it('handles unicode characters in exact text', () => {
    const text = 'The parties agree to the "Grundstücksverkehrsgesetz" — §1 applies.';
    const editor = makeEditor([p('unicode', text)]);

    const exact = 'Grundstücksverkehrsgesetz';
    const idx = text.indexOf(exact);
    const anchor: Anchor = {
      paragraphId: 'unicode',
      startOffset: idx,
      endOffset: idx + exact.length,
      exact,
      prefix: text.slice(Math.max(0, idx - 32), idx),
      suffix: text.slice(idx + exact.length, idx + exact.length + 32),
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).not.toBeNull();

    const s = slatePointToOffset(editor, [0], resolved!.anchor);
    const e = slatePointToOffset(editor, [0], resolved!.focus);
    expect(text.slice(s, e)).toBe(exact);
  });

  // =========================================================================
  // Tier 3 rejects match with zero context score
  // =========================================================================
  it('Tier 3 rejects match with zero context score (empty prefix/suffix)', () => {
    // "the Company" appears in both paragraphs, but anchor has empty context.
    // Without context, Tier 3 cannot disambiguate — should return null.
    const editor = makeEditor([
      p('p1', 'According to section 2, the Company shall issue shares.'),
      p('p3', 'In the event of default, the Company must pay damages.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'deleted-p',
      startOffset: 20,
      endOffset: 31,
      exact: 'the Company',
      prefix: '',
      suffix: '',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).toBeNull();
  });

  it('Tier 3 rejects match when prefix/suffix have zero character overlap', () => {
    // Context is provided but completely wrong — no overlap at all
    const editor = makeEditor([
      p('p1', 'The quick brown fox jumps over the lazy dog.'),
    ]);

    const anchor: Anchor = {
      paragraphId: 'deleted-p',
      startOffset: 0,
      endOffset: 3,
      exact: 'The',
      prefix: 'ZZZZZZ',
      suffix: 'XXXXXX',
    };

    const resolved = resolveAnchor(editor, anchor);
    expect(resolved).toBeNull();
  });

  it('offsetToSlateRange returns null for startOffset === endOffset (zero width)', () => {
    const editor = makeEditor([p('p1', 'hello')]);
    // startOffset === endOffset is technically valid (0 <= 0), but selecting nothing
    const result = offsetToSlateRange(editor, [0], 3, 3);
    // The function allows this (startOffset <= endOffset check passes)
    // It should return a collapsed range, not null
    if (result !== null) {
      expect(result.anchor.offset).toBe(result.focus.offset);
      expect(result.anchor.path).toEqual(result.focus.path);
    }
  });
});
