import { useCallback, useMemo } from 'react';
import { useEditorRef } from 'platejs/react';
import { useAnnotationStore } from '@/lib/annotations/store';
import type { Annotation } from '@/types/annotations';
import { SidebarHeader } from '@/components/sidebar/sidebar-header';
import { AnnotationCard } from '@/components/sidebar/annotation-card';
import {
  applySuggestionAccept,
  applySuggestionReject,
  applyCommentResolve,
} from '@/lib/annotations/suggestion-actions';

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 space-y-3"
      data-testid="skeleton-card"
    >
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-100" />
      </div>
      <div className="h-3 w-full rounded bg-gray-100" />
      <div className="h-3 w-3/4 rounded bg-gray-100" />
      <div className="h-3 w-1/2 rounded bg-gray-100" />
    </div>
  );
}

/** Compare two annotations by their anchor's paragraph position. */
function compareParagraphPosition(a: Annotation, b: Annotation): number {
  const aNum = extractParagraphIndex(a.anchor.paragraphId);
  const bNum = extractParagraphIndex(b.anchor.paragraphId);
  if (aNum !== bNum) return aNum - bNum;
  return a.anchor.startOffset - b.anchor.startOffset;
}

function extractParagraphIndex(id: string): number {
  const match = id.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export function SidebarPanel() {
  const editor = useEditorRef();
  const discussions = useAnnotationStore((s) => s.discussions);
  const reviewItems = useAnnotationStore((s) => s.reviewItems);
  const selectedCardId = useAnnotationStore((s) => s.selectedCardId);
  const filterType = useAnnotationStore((s) => s.filterType);
  const isReviewLoading = useAnnotationStore((s) => s.isReviewLoading);
  const setSelectedCard = useAnnotationStore((s) => s.setSelectedCard);
  const setFilterType = useAnnotationStore((s) => s.setFilterType);

  const handleAccept = useCallback(
    (id: string) => applySuggestionAccept(editor, id),
    [editor],
  );
  const handleReject = useCallback(
    (id: string) => applySuggestionReject(editor, id),
    [editor],
  );
  const handleResolve = useCallback(
    (id: string) => applyCommentResolve(editor, id),
    [editor],
  );

  const annotations = useMemo(() => {
    let items: Annotation[] = [];
    if (filterType === 'all' || filterType === 'comment') {
      items = [...items, ...discussions];
    }
    if (filterType === 'all' || filterType === 'suggestion') {
      items = [...items, ...reviewItems];
    }
    return items.sort(compareParagraphPosition);
  }, [discussions, reviewItems, filterType]);

  // Loading state: show skeleton cards
  if (isReviewLoading) {
    return (
      <div className="p-4 h-full flex flex-col">
        <SidebarHeader
          itemCount={0}
          activeFilter={filterType}
          onFilterChange={setFilterType}
        />
        <div className="flex-1 overflow-y-auto space-y-3">
          <p className="text-sm text-gray-500 mb-2" data-testid="loading-text">
            Analyzing document...
          </p>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (annotations.length === 0) {
    return (
      <div className="p-4">
        <SidebarHeader
          itemCount={0}
          activeFilter={filterType}
          onFilterChange={setFilterType}
        />
        <p className="mt-4 text-sm text-gray-400" data-testid="empty-state">
          No items to review
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <SidebarHeader
        itemCount={annotations.length}
        activeFilter={filterType}
        onFilterChange={setFilterType}
      />
      {/* TODO: Virtualize card list for large review sets (100+ items). Currently renders all cards. */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {annotations.map((annotation) => (
          <AnnotationCard
            key={annotation.id}
            annotation={annotation}
            isSelected={selectedCardId === annotation.id}
            onClick={setSelectedCard}
            onAccept={handleAccept}
            onReject={handleReject}
            onResolve={handleResolve}
          />
        ))}
      </div>
    </div>
  );
}
