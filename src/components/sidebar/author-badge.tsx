import type { AuthorType } from '@/types/annotations';

const AUTHOR_CONFIG: Record<AuthorType, { label: string; classes: string }> = {
  ai: { label: 'Perry', classes: 'bg-purple-100 text-purple-800' },
  user: { label: 'You', classes: 'bg-blue-100 text-blue-800' },
};

interface AuthorBadgeProps {
  author: AuthorType;
}

export function AuthorBadge({ author }: AuthorBadgeProps) {
  const config = AUTHOR_CONFIG[author];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
      data-testid="author-badge"
    >
      {config.label}
    </span>
  );
}
