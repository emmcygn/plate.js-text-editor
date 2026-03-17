import { describe, it, expect } from 'vitest';
import { createSlateEditor } from 'platejs';
import { BaseCommentPlugin, getCommentKey } from '@platejs/comment';
import {
  BaseSuggestionPlugin,
  setSuggestionNodes,
  getInlineSuggestionData,
} from '@platejs/suggestion';
import type { Descendant } from 'platejs';

function makeEditor(blocks: Array<{ id: string; text: string }>) {
  const value: Descendant[] = blocks.map((b) => ({
    type: 'p',
    id: b.id,
    children: [{ text: b.text }],
  }));

  return createSlateEditor({
    plugins: [
      BaseCommentPlugin,
      BaseSuggestionPlugin.configure({
        options: { currentUserId: 'user-1', isSuggesting: false },
      }),
    ],
    value,
  });
}

// ---------------------------------------------------------------------------
// Comment mark creation
// ---------------------------------------------------------------------------
describe('Comment marks', () => {
  it('addMark applies comment marks to selected text', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'The Company shall notify all parties.' },
    ]);

    // Select "Company"
    editor.select({
      anchor: { path: [0, 0], offset: 4 },
      focus: { path: [0, 0], offset: 11 },
    });

    const commentId = 'test-comment-1';
    editor.addMark('comment', true);
    editor.addMark(getCommentKey(commentId), true);

    // Verify nodes exist via api
    const nodes = editor.api.comment.nodes({ id: commentId });
    expect(nodes.length).toBeGreaterThan(0);

    // Verify the marked text has the comment key
    const [markedNode] = nodes[0];
    const nodeAny = markedNode as Record<string, unknown>;
    expect(nodeAny[getCommentKey(commentId)]).toBe(true);
  });

  it('unsetMark removes comment marks by id', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'The Company shall notify.' },
    ]);

    editor.select({
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 11 },
    });
    const commentId = 'cmt-remove-1';
    editor.addMark('comment', true);
    editor.addMark(getCommentKey(commentId), true);

    expect(editor.api.comment.nodes({ id: commentId }).length).toBeGreaterThan(0);

    editor.tf.comment.unsetMark({ id: commentId });

    expect(editor.api.comment.nodes({ id: commentId }).length).toBe(0);
  });

  it('multiple comments can coexist on overlapping text', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'The Company shall notify all parties.' },
    ]);

    // Comment 1: "Company shall"
    editor.select({
      anchor: { path: [0, 0], offset: 4 },
      focus: { path: [0, 0], offset: 17 },
    });
    editor.addMark('comment', true);
    editor.addMark(getCommentKey('cmt-1'), true);

    // Comment 2: "shall notify" — need to find the right path after split
    // After first comment, text is split. Use editor.nodes to find "shall"
    // Actually, re-select by offset on the block level doesn't work since nodes split.
    // Instead, use the block-level text content approach.

    // The text is now split into nodes. Let's just select by searching for the text.
    // For testing, select using known resulting paths or use marks on the whole paragraph.
    const allChildren = editor.children[0].children as Array<{ text: string }>;

    // After first addMark, the block has split text nodes.
    // Find "shall" in the children to determine correct path/offset.
    for (let i = 0; i < allChildren.length; i++) {
      const t = allChildren[i].text;
      const shallIdx = t.indexOf('shall');
      if (shallIdx >= 0) {
        // Select from "shall" to "notify" (includes " ")
        editor.select({
          anchor: { path: [0, i], offset: shallIdx },
          focus: { path: [0, i], offset: shallIdx + 13 }, // "shall notify"
        });
        break;
      }
    }

    editor.addMark('comment', true);
    editor.addMark(getCommentKey('cmt-2'), true);

    expect(editor.api.comment.nodes({ id: 'cmt-1' }).length).toBeGreaterThan(0);
    expect(editor.api.comment.nodes({ id: 'cmt-2' }).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suggesting mode
// ---------------------------------------------------------------------------
describe('Suggesting mode', () => {
  it('isSuggesting defaults to false', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'Hello world.' }]);
    expect(editor.getOption(BaseSuggestionPlugin, 'isSuggesting')).toBe(false);
  });

  it('setOption toggles isSuggesting', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'Hello world.' }]);

    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', true);
    expect(editor.getOption(BaseSuggestionPlugin, 'isSuggesting')).toBe(true);

    editor.setOption(BaseSuggestionPlugin, 'isSuggesting', false);
    expect(editor.getOption(BaseSuggestionPlugin, 'isSuggesting')).toBe(false);
  });

  it('setSuggestionNodes marks text as deletion suggestion', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'Remove this text please.' },
    ]);

    const range = {
      anchor: { path: [0, 0], offset: 7 },
      focus: { path: [0, 0], offset: 16 },
    };

    setSuggestionNodes(editor, {
      at: range,
      suggestionId: 'sug-1',
      suggestionDeletion: true,
      createdAt: Date.now(),
    });

    // Check via api
    const entries = editor.api.suggestion.nodes();
    expect(entries.length).toBeGreaterThan(0);

    const [node] = entries[0];
    const data = getInlineSuggestionData(node);
    expect(data).toBeDefined();
    expect(data!.type).toBe('remove');
    expect(data!.id).toBe('sug-1');
  });
});

// ---------------------------------------------------------------------------
// Adversarial tests
// ---------------------------------------------------------------------------
describe('Adversarial: Comment + Suggestion edge cases', () => {
  it('adding comment to collapsed selection creates no nodes', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'Some text.' }]);

    editor.select({
      anchor: { path: [0, 0], offset: 5 },
      focus: { path: [0, 0], offset: 5 },
    });

    editor.addMark('comment', true);
    editor.addMark(getCommentKey('cmt-empty'), true);

    const nodes = editor.api.comment.nodes({ id: 'cmt-empty' });
    expect(nodes.length).toBe(0);
  });

  it('setSuggestionNodes on collapsed range does not throw', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'Short.' }]);

    expect(() => {
      setSuggestionNodes(editor, {
        at: {
          anchor: { path: [0, 0], offset: 0 },
          focus: { path: [0, 0], offset: 0 },
        },
        suggestionId: 'sug-noop',
        suggestionDeletion: true,
        createdAt: Date.now(),
      });
    }).not.toThrow();
  });

  it('rapid toggle of suggesting mode does not corrupt state', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'Test text.' }]);

    for (let i = 0; i < 20; i++) {
      editor.setOption(BaseSuggestionPlugin, 'isSuggesting', i % 2 === 0);
    }

    expect(editor.getOption(BaseSuggestionPlugin, 'isSuggesting')).toBe(false);
  });

  it('removing comment that does not exist does not throw', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'No comments here.' }]);

    expect(() => {
      editor.tf.comment.unsetMark({ id: 'nonexistent-id' });
    }).not.toThrow();
  });
});
