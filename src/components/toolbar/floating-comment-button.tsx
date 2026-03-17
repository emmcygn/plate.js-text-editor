import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorRef, useEditorSelection } from 'platejs/react';
import { getCommentKey } from '@platejs/comment';
import { nanoid } from 'platejs';
import { createAnchor } from '@/lib/anchoring';
import { useAnnotationStore } from '@/lib/annotations/store';
import type { Discussion } from '@/types/annotations';

/**
 * Floating button that appears when text is selected.
 * Click opens a comment form. Submit creates a Discussion in the store
 * and applies comment marks to the selected text.
 */
export function FloatingCommentButton() {
  const editor = useEditorRef();
  const selection = useEditorSelection();
  const [showForm, setShowForm] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef(selection);

  const hasSelection = selection && !(
    selection.anchor.path.length === selection.focus.path.length &&
    selection.anchor.path.every((v: number, i: number) => v === selection.focus.path[i]) &&
    selection.anchor.offset === selection.focus.offset
  );

  const updatePosition = useCallback(() => {
    try {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;

      const domRange = domSelection.getRangeAt(0);
      const rect = domRange.getBoundingClientRect();

      // Guard against collapsed/zero-size rects (e.g. when focus moves to textarea)
      if (rect.width === 0 && rect.height === 0) return;

      setPosition({
        top: rect.top - 40,
        left: rect.left + rect.width / 2,
      });
    } catch {
      // DOM range may be invalid during editor operations
    }
  }, []);

  // Update position when selection changes
  useEffect(() => {
    if (!hasSelection) {
      if (!showForm) {
        setPosition(null);
      }
      return;
    }

    savedSelectionRef.current = selection;
    updatePosition();
  }, [hasSelection, selection, showForm, updatePosition]);

  // Recalculate position on scroll (only when DOM selection is live, not when form is open)
  useEffect(() => {
    if (!hasSelection || showForm) return;

    const scrollContainer = document.querySelector('main.overflow-y-auto') ??
      document.querySelector('main');
    if (!scrollContainer) return;

    const handleScroll = () => updatePosition();
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [hasSelection, showForm, updatePosition]);

  const handleSubmit = useCallback(() => {
    const sel = savedSelectionRef.current;
    if (!commentText.trim() || !sel) return;

    const anchor = createAnchor(editor, sel);
    if (!anchor) return;

    const commentId = nanoid(10);

    // Apply comment marks to text
    // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
    editor.select(sel);
    // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
    editor.addMark('comment', true);
    // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
    editor.addMark(getCommentKey(commentId), true);
    // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
    editor.deselect();

    // Create Discussion in store
    const discussion: Discussion = {
      type: 'discussion',
      id: commentId,
      anchor,
      author: 'user',
      text: commentText.trim(),
      quotedText: anchor.exact,
      replies: [],
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };

    useAnnotationStore.getState().addDiscussion(discussion);

    // Reset state
    setCommentText('');
    setShowForm(false);
    setPosition(null);
  }, [editor, commentText]);

  const handleCancel = useCallback(() => {
    setCommentText('');
    setShowForm(false);
  }, []);

  if (!position || (!hasSelection && !showForm)) return null;

  return (
    <div
      ref={formRef}
      className="fixed z-50"
      style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
    >
      {showForm ? (
        <div
          className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64"
          onMouseDown={(e) => e.preventDefault()}
        >
          <textarea
            className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            placeholder="Add your comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            autoFocus
            data-testid="comment-input"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded text-gray-600 hover:bg-gray-100"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={!commentText.trim()}
              data-testid="comment-submit"
            >
              Comment
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
          onMouseDown={(e) => {
            e.preventDefault();
            savedSelectionRef.current = selection;
            setShowForm(true);
          }}
          data-testid="add-comment-button"
        >
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
            />
          </svg>
          Comment
        </button>
      )}
    </div>
  );
}
