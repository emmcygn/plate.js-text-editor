import type { Discussion } from '@/types/annotations';
import { AuthorBadge } from '@/components/sidebar/author-badge';

interface CommentCardProps {
  discussion: Discussion;
  isSelected: boolean;
  onClick: (id: string) => void;
  onResolve: (id: string) => void;
}

export function CommentCard({
  discussion,
  isSelected,
  onClick,
  onResolve,
}: CommentCardProps) {
  const isResolved = discussion.resolvedAt !== null;

  return (
    <div
      className={`rounded-lg border border-l-4 p-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 border-l-blue-500'
          : 'border-gray-200 border-l-transparent bg-white hover:border-gray-300'
      }`}
      onClick={() => onClick(discussion.id)}
      data-testid="comment-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <AuthorBadge author={discussion.author} />
        <span className="text-xs text-gray-500">Comment</span>
      </div>

      <div
        className="border-l-2 border-gray-300 pl-2 mb-2 text-sm italic text-gray-600 break-words"
        data-testid="quoted-text"
      >
        {discussion.quotedText}
      </div>

      <p className="text-sm text-gray-800 break-words">{discussion.text}</p>

      {!isResolved && (
        <div className="mt-2 flex justify-end">
          <button
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 min-h-[28px] rounded hover:bg-gray-100"
            onClick={(e) => {
              e.stopPropagation();
              onResolve(discussion.id);
            }}
            data-testid="resolve-button"
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}
