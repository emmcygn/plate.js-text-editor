import type { ReviewItem } from '@/types/annotations';
import { SeverityBadge } from '@/components/sidebar/severity-badge';

interface SuggestionCardProps {
  item: ReviewItem;
  isSelected: boolean;
  onClick: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function SuggestionCard({
  item,
  isSelected,
  onClick,
  onAccept,
  onReject,
}: SuggestionCardProps) {
  const isPending = item.status === 'pending';

  return (
    <div
      className={`rounded-lg border border-l-4 p-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 border-l-blue-500'
          : 'border-gray-200 border-l-transparent bg-white hover:border-gray-300'
      }`}
      onClick={() => onClick(item.id)}
      data-testid="suggestion-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <SeverityBadge severity={item.severity} />
        <span className="text-xs text-gray-500">{item.clause}</span>
      </div>

      <div className="mb-2 text-sm space-y-1">
        {item.originalText && (
          <div className="break-words">
            <span
              className="bg-red-100 text-red-800 line-through"
              data-testid="original-text"
            >
              {item.originalText}
            </span>
          </div>
        )}
        {item.suggestedText && (
          <div className="break-words">
            <span
              className="bg-green-100 text-green-800"
              data-testid="suggested-text"
            >
              {item.suggestedText}
            </span>
          </div>
        )}
        {item.action === 'delete' && !item.suggestedText && (
          <div className="text-xs text-gray-500 italic">(delete)</div>
        )}
      </div>

      <p className="text-xs text-gray-600 break-words">{item.rationale}</p>

      {item.status !== 'pending' && (
        <div className="mt-2">
          <span
            className={`text-xs font-medium ${
              item.status === 'accepted' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {item.status === 'accepted' ? 'Accepted' : 'Rejected'}
          </span>
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          className="text-xs px-3 py-1.5 min-h-[28px] min-w-[56px] rounded hover:bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            onReject(item.id);
          }}
          disabled={!isPending}
          data-testid="reject-button"
        >
          Reject
        </button>
        <button
          className="text-xs px-3 py-1.5 min-h-[28px] min-w-[56px] rounded hover:bg-green-50 text-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            onAccept(item.id);
          }}
          disabled={!isPending}
          data-testid="accept-button"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
