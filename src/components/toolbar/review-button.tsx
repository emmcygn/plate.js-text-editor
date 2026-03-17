import { useCallback } from 'react';
import { useEditorRef } from 'platejs/react';
import { useAnnotationStore } from '@/lib/annotations/store';
import { triggerReview } from '@/lib/mock-review/inject-review';

/**
 * "Get Perry's Review" button. Must be rendered inside a <Plate> provider
 * to access the editor ref for anchor resolution.
 *
 * Loading state: spinner replaces icon, button disabled.
 * After review: button stays disabled (single-use per session).
 */
interface ReviewButtonProps {
  isSampleDocument?: boolean;
}

export function ReviewButton({ isSampleDocument = true }: ReviewButtonProps) {
  const editor = useEditorRef();
  const isLoading = useAnnotationStore((s) => s.isReviewLoading);
  const hasItems = useAnnotationStore(
    (s) => s.reviewItems.length > 0 || s.discussions.length > 0,
  );

  const handleClick = useCallback(() => {
    triggerReview(editor)
      .then((result) => {
        if (result.skippedIds.length > 0) {
          console.warn(
            `Review injection: ${result.skippedIds.length} items skipped (unresolvable anchors):`,
            result.skippedIds,
          );
        }
      })
      .catch((err: unknown) => {
        console.error('Review injection failed:', err);
      });
  }, [editor]);

  const isDisabled = isLoading || hasItems || !isSampleDocument;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      data-testid="review-button"
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
        transition-colors duration-150
        ${isDisabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
        }
      `}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          data-testid="review-spinner"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
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
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
          />
        </svg>
      )}
      {isLoading
        ? 'Reviewing...'
        : isSampleDocument
          ? "Get Perry's Review"
          : 'AI review (sample doc only)'}
    </button>
  );
}
