import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { EditorPanel } from '@/components/layout/editor-panel';
import { SidebarPanel } from '@/components/layout/sidebar-panel';
import { PlateEditor, PlateEditorContent } from '@/editor/plate-editor';
import { ReviewButton } from '@/components/toolbar/review-button';
import { SuggestingToggle } from '@/components/toolbar/suggesting-toggle';
import { FloatingCommentButton } from '@/components/toolbar/floating-comment-button';
import { convertDocxToHtml } from '@/lib/docx-import';

export function App() {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      try {
        // TODO: Replace hardcoded DOCX path with file upload UI or document picker.
        const response = await fetch('/document.docx');
        if (!response.ok) throw new Error('Failed to load document');
        const arrayBuffer = await response.arrayBuffer();
        const result = await convertDocxToHtml(arrayBuffer);
        if (result.warnings.length > 0) {
          console.warn('DOCX import warnings:', result.warnings);
        }
        setHtml(result.html);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadDocument();
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-red-600 text-center">
          <h1 className="text-lg font-semibold">Error loading document</h1>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !html) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading document...</p>
      </div>
    );
  }

  return (
    <PlateEditor initialHtml={html}>
      <AppShell
        toolbar={
          <>
            <SuggestingToggle />
            <ReviewButton />
          </>
        }
        editor={
          <EditorPanel>
            <div className="relative">
              <FloatingCommentButton />
              <PlateEditorContent />
            </div>
          </EditorPanel>
        }
        sidebar={<SidebarPanel />}
      />
    </PlateEditor>
  );
}
