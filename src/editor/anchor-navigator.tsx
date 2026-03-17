import { useEffect } from 'react';
import { useEditorRef } from 'platejs/react';
import { useAnnotationStore } from '@/lib/annotations/store';
import { resolveAnchor } from '@/lib/anchoring';

/**
 * Headless component placed inside <Plate> that watches `selectedCardId`
 * and triggers scroll + persistent highlight when a sidebar card is clicked.
 *
 * Highlight stays active as long as a card is selected. Clicking a different
 * card moves the highlight. Deselecting clears it.
 *
 * The actual decoration rendering is driven by PlateEditorContent subscribing
 * to the Zustand store (highlightRange/highlightPhase). This component only
 * resolves anchors and updates the store.
 *
 * Must be rendered inside the Plate provider to access the editor ref.
 */
export function AnchorNavigator() {
  const editor = useEditorRef();
  const selectedCardId = useAnnotationStore((s) => s.selectedCardId);

  useEffect(() => {
    const { setHighlightRange, setHighlightPhase, discussions, reviewItems } =
      useAnnotationStore.getState();

    if (!selectedCardId) {
      setHighlightRange(null);
      setHighlightPhase(null);
      return;
    }

    // Find the annotation by ID
    const annotation = [...discussions, ...reviewItems].find(
      (a) => a.id === selectedCardId,
    );
    if (!annotation) return;

    // Resolve the anchor to a Slate range
    const range = resolveAnchor(editor, annotation.anchor);
    if (!range) return;

    // Scroll the exact text range into view
    try {
      const domRange = editor.api.toDOMRange(range);
      if (domRange) {
        const startEl =
          domRange.startContainer.nodeType === Node.TEXT_NODE
            ? domRange.startContainer.parentElement
            : (domRange.startContainer as Element);
        startEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch {
      // Fallback: scroll the block into view
      try {
        const blockPath = range.anchor.path.slice(0, -1);
        // @ts-expect-error — Plate.js v52 SlateEditor types legacy Slate methods as unknown
        const blockEntry = editor.node(blockPath) as [Record<string, unknown>, number[]] | undefined;
        if (blockEntry) {
          const domNode = editor.api.toDOMNode(blockEntry[0] as Parameters<typeof editor.api.toDOMNode>[0]);
          domNode?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        // DOM not ready
      }
    }

    // Persistent highlight — store update triggers re-render in PlateEditorContent
    setHighlightRange(range);
    setHighlightPhase('active');
  }, [selectedCardId, editor]);

  return null;
}
