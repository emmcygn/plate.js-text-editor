import type { PlateLeafProps } from 'platejs/react';
import { getInlineSuggestionData } from '@platejs/suggestion';

/**
 * Leaf component for rendering suggestion-marked text.
 * Used as render.node on SuggestionPlugin.
 * Pipeline wraps in <span data-slate-leaf> — we only add styling.
 *
 * - Deletions: red background + strikethrough
 * - Insertions: green background
 */
export function SuggestionLeaf({ children, leaf }: PlateLeafProps) {
  const data = getInlineSuggestionData(
    leaf as Parameters<typeof getInlineSuggestionData>[0],
  );

  if (!data) return <>{children}</>;

  if (data.type === 'remove') {
    return (
      <span
        style={{
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          textDecoration: 'line-through',
        }}
      >
        {children}
      </span>
    );
  }

  if (data.type === 'insert') {
    return (
      <span
        style={{
          backgroundColor: '#dcfce7',
          color: '#166534',
        }}
      >
        {children}
      </span>
    );
  }

  // Fallback: update or unknown type
  return (
    <span
      style={{
        backgroundColor: '#dbeafe',
        color: '#1e40af',
      }}
    >
      {children}
    </span>
  );
}
