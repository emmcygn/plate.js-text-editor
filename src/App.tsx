import { useState, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { EditorPanel } from '@/components/layout/editor-panel';
import { SidebarPanel } from '@/components/layout/sidebar-panel';
import { PlateEditor, PlateEditorContent } from '@/editor/plate-editor';
import { ReviewButton } from '@/components/toolbar/review-button';
import { SuggestingToggle } from '@/components/toolbar/suggesting-toggle';
import { FloatingCommentButton } from '@/components/toolbar/floating-comment-button';
import { convertDocxToHtml } from '@/lib/docx-import';
import { useAnnotationStore } from '@/lib/annotations/store';

export function App() {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSampleDocument, setIsSampleDocument] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetStore = useAnnotationStore((s) => s.resetStore);

  const loadFromArrayBuffer = useCallback(
    async (arrayBuffer: ArrayBuffer, isSample: boolean) => {
      setLoading(true);
      setError(null);
      setHtml(null);
      resetStore();
      try {
        const result = await convertDocxToHtml(arrayBuffer);
        if (result.warnings.length > 0) {
          console.warn('DOCX import warnings:', result.warnings);
        }
        setHtml(result.html);
        setIsSampleDocument(isSample);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to convert document');
      } finally {
        setLoading(false);
      }
    },
    [resetStore],
  );

  const loadSampleDocument = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/document.docx');
      if (!response.ok) throw new Error('Failed to load sample document');
      const arrayBuffer = await response.arrayBuffer();
      await loadFromArrayBuffer(arrayBuffer, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample document');
      setLoading(false);
    }
  }, [loadFromArrayBuffer]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.docx')) {
        setError('Please upload a .docx file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          loadFromArrayBuffer(reader.result, false);
        }
      };
      reader.onerror = () => setError('Failed to read file');
      reader.readAsArrayBuffer(file);
    },
    [loadFromArrayBuffer],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="text-red-600">
            <h1 className="text-lg font-semibold">Error loading document</h1>
            <p className="mt-2 text-sm">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <p className="text-gray-500">Loading document...</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center w-[480px] h-[280px]
            border-2 border-dashed rounded-xl cursor-pointer
            transition-colors duration-150
            ${isDragOver
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
            }
          `}
        >
          <svg
            className="h-10 w-10 text-gray-400 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-700">
            Drop a .docx file here, or click to browse
          </p>
          <p className="mt-3 text-xs text-gray-400">or</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadSampleDocument();
            }}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium underline"
          >
            Load Sample Document
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <PlateEditor initialHtml={html} key={html}>
      <AppShell
        toolbar={
          <>
            <SuggestingToggle />
            <ReviewButton isSampleDocument={isSampleDocument} />
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
