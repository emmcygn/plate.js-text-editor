import { describe, it, expect, beforeEach } from 'vitest';
import { createSlateEditor } from 'platejs';
import type { Descendant } from 'platejs';
import { BaseCommentPlugin, getCommentKey } from '@platejs/comment';
import {
  BaseSuggestionPlugin,
  setSuggestionNodes,
  getInlineSuggestionData,
} from '@platejs/suggestion';
import { useAnnotationStore } from '@/lib/annotations/store';
import {
  applySuggestionAccept,
  applySuggestionReject,
  applyCommentResolve,
} from '../suggestion-actions';

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

function addSuggestionToStore(id: string) {
  useAnnotationStore.getState().addReviewItem({
    type: 'reviewItem',
    id,
    anchor: {
      paragraphId: 'p-1',
      startOffset: 0,
      endOffset: 10,
      exact: 'test',
      prefix: '',
      suffix: '',
    },
    author: 'ai',
    action: 'replace',
    originalText: 'old text',
    suggestedText: 'new text',
    rationale: 'test rationale',
    severity: 'minor',
    clause: '1.1',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

function addDiscussionToStore(id: string) {
  useAnnotationStore.getState().addDiscussion({
    type: 'discussion',
    id,
    anchor: {
      paragraphId: 'p-1',
      startOffset: 0,
      endOffset: 10,
      exact: 'test',
      prefix: '',
      suffix: '',
    },
    author: 'ai',
    text: 'Some comment',
    quotedText: 'test text',
    replies: [],
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  });
}

beforeEach(() => {
  useAnnotationStore.setState({
    discussions: [],
    reviewItems: [],
    selectedCardId: null,
    filterType: 'all',
    isReviewLoading: false,
    highlightRange: null,
    highlightPhase: null,
  });
});

// ---------------------------------------------------------------------------
// Accept suggestion
// ---------------------------------------------------------------------------
describe('applySuggestionAccept', () => {
  it('accepts a deletion suggestion — removes marked text', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'Remove this word here.' },
    ]);

    setSuggestionNodes(editor, {
      at: {
        anchor: { path: [0, 0], offset: 7 },
        focus: { path: [0, 0], offset: 12 },
      },
      suggestionId: 'sug-del-1',
      suggestionDeletion: true,
      createdAt: Date.now(),
    });

    addSuggestionToStore('sug-del-1');

    const success = applySuggestionAccept(editor, 'sug-del-1');
    expect(success).toBe(true);

    // Suggestion nodes should be gone
    const remainingNodes = editor.api.suggestion.nodes().filter(([node]) => {
      const data = getInlineSuggestionData(node);
      return data && data.id === 'sug-del-1';
    });
    expect(remainingNodes.length).toBe(0);

    // Store should be updated
    const item = useAnnotationStore.getState().reviewItems.find((r) => r.id === 'sug-del-1');
    expect(item?.status).toBe('accepted');
  });

  it('returns false for non-existent suggestion', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'No suggestions.' }]);
    const success = applySuggestionAccept(editor, 'nonexistent');
    expect(success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reject suggestion
// ---------------------------------------------------------------------------
describe('applySuggestionReject', () => {
  it('rejects a deletion suggestion — keeps original text', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'Keep this text intact.' },
    ]);

    setSuggestionNodes(editor, {
      at: {
        anchor: { path: [0, 0], offset: 5 },
        focus: { path: [0, 0], offset: 10 },
      },
      suggestionId: 'sug-rej-1',
      suggestionDeletion: true,
      createdAt: Date.now(),
    });

    addSuggestionToStore('sug-rej-1');

    const success = applySuggestionReject(editor, 'sug-rej-1');
    expect(success).toBe(true);

    // Suggestion nodes should be gone
    const remainingNodes = editor.api.suggestion.nodes().filter(([node]) => {
      const data = getInlineSuggestionData(node);
      return data && data.id === 'sug-rej-1';
    });
    expect(remainingNodes.length).toBe(0);

    // Store should be updated
    const item = useAnnotationStore.getState().reviewItems.find((r) => r.id === 'sug-rej-1');
    expect(item?.status).toBe('rejected');
  });

  it('returns false for non-existent suggestion', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'Nothing here.' }]);
    const success = applySuggestionReject(editor, 'nonexistent');
    expect(success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Resolve comment
// ---------------------------------------------------------------------------
describe('applyCommentResolve', () => {
  it('resolves a comment and updates store', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'Comment on this text.' },
    ]);

    const commentId = 'cmt-resolve-1';
    editor.select({
      anchor: { path: [0, 0], offset: 11 },
      focus: { path: [0, 0], offset: 15 },
    });
    editor.addMark('comment', true);
    editor.addMark(getCommentKey(commentId), true);

    addDiscussionToStore(commentId);

    applyCommentResolve(editor, commentId);

    const disc = useAnnotationStore.getState().discussions.find((d) => d.id === commentId);
    expect(disc?.resolvedAt).not.toBeNull();
  });

  it('resolving non-existent comment does not throw', () => {
    const editor = makeEditor([{ id: 'p-1', text: 'No comments.' }]);
    addDiscussionToStore('cmt-nonexist');

    expect(() => {
      applyCommentResolve(editor, 'cmt-nonexist');
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Adversarial
// ---------------------------------------------------------------------------
describe('Adversarial: suggestion actions', () => {
  it('double accept does not throw', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'Double accept test.' },
    ]);

    setSuggestionNodes(editor, {
      at: {
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 6 },
      },
      suggestionId: 'sug-double',
      suggestionDeletion: true,
      createdAt: Date.now(),
    });

    addSuggestionToStore('sug-double');

    applySuggestionAccept(editor, 'sug-double');

    expect(() => {
      applySuggestionAccept(editor, 'sug-double');
    }).not.toThrow();
  });

  it('accept then reject does not throw', () => {
    const editor = makeEditor([
      { id: 'p-1', text: 'Accept then reject.' },
    ]);

    setSuggestionNodes(editor, {
      at: {
        anchor: { path: [0, 0], offset: 0 },
        focus: { path: [0, 0], offset: 6 },
      },
      suggestionId: 'sug-ar',
      suggestionDeletion: true,
      createdAt: Date.now(),
    });

    addSuggestionToStore('sug-ar');
    applySuggestionAccept(editor, 'sug-ar');

    const result = applySuggestionReject(editor, 'sug-ar');
    expect(result).toBe(false);
  });
});
