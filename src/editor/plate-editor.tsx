import { type ReactNode, useMemo, useCallback } from 'react';
import { Plate, PlateContent, usePlateEditor } from 'platejs/react';
import { type Value, type TRange, createSlateEditor, deserializeHtml } from 'platejs';
import { editorPlugins } from '@/editor/editor-kit';
import { assignNodeIds } from '@/lib/docx-import';
import { AnchorNavigator } from '@/editor/anchor-navigator';
import { useAnnotationStore } from '@/lib/annotations/store';
import { rangeIntersection } from '@/editor/plugins/highlight-plugin';
import type { DecoratedRange } from 'platejs';

interface PlateEditorProps {
  initialHtml?: string;
  initialValue?: Value;
  /** Children rendered inside the Plate provider. Use for components that need editor access (toolbar, sidebar). */
  children?: ReactNode;
}

// TODO: Add React error boundaries around editor and sidebar independently.
export function PlateEditor({ initialHtml, initialValue, children }: PlateEditorProps) {
  const value = useMemo(() => {
    if (initialValue) return initialValue;
    if (!initialHtml) return undefined;

    // Create a temporary headless editor for deserialization
    const tempEditor = createSlateEditor({ plugins: editorPlugins });
    const fragment = deserializeHtml(tempEditor, { element: initialHtml });

    return assignNodeIds(fragment) as Value;
  }, [initialHtml, initialValue]);

  const editor = usePlateEditor(
    {
      plugins: editorPlugins,
      value: value,
    },
    [],
  );

  return (
    <Plate editor={editor}>
      <AnchorNavigator />
      {children}
    </Plate>
  );
}

/**
 * The editable content area. Must be rendered inside PlateEditor.
 *
 * Handles highlight + comment decorations via the `decorate` prop so
 * they react to Zustand store changes (React subscription) without
 * needing `editor.api.redecorate()`.
 */
export function PlateEditorContent() {
  // Subscribe to Zustand — component re-renders when these change,
  // which gives PlateContent a new `decorate` function reference,
  // triggering re-decoration of all nodes.
  const highlightRange = useAnnotationStore((s) => s.highlightRange);
  const highlightPhase = useAnnotationStore((s) => s.highlightPhase);

  const decorate = useCallback(
    ({ entry }: { entry: [node: Record<string, unknown>, path: number[]] }) => {
      const [node, path] = entry;
      if (typeof node.text !== 'string') return [];

      const results: DecoratedRange[] = [];

      // --- Click-to-navigate highlight ---
      if (highlightRange && highlightPhase) {
        const nodeRange: TRange = {
          anchor: { path, offset: 0 },
          focus: { path, offset: node.text.length },
        };
        const intersection = rangeIntersection(highlightRange, nodeRange);
        if (intersection) {
          results.push({
            ...intersection,
            highlight: true,
          } as DecoratedRange);
        }
      }

      // --- Comment highlight (comment_* keys) ---
      const hasComment = Object.keys(node).some((key) => key.startsWith('comment_'));
      if (hasComment) {
        results.push({
          anchor: { path, offset: 0 },
          focus: { path, offset: node.text.length },
          commentHighlight: true,
        } as DecoratedRange);
      }

      return results;
    },
    [highlightRange, highlightPhase],
  );

  return (
    <PlateContent
      className="outline-none"
      placeholder="Loading document..."
      decorate={decorate}
    />
  );
}
