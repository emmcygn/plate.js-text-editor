import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Plate, usePlateEditor } from 'platejs/react';
import { SeverityBadge } from '../severity-badge';
import { AuthorBadge } from '../author-badge';
import { CommentCard } from '../comment-card';
import { SuggestionCard } from '../suggestion-card';
import { SidebarHeader } from '../sidebar-header';
import { SidebarPanel } from '@/components/layout/sidebar-panel';
import { useAnnotationStore } from '@/lib/annotations/store';
import { editorPlugins } from '@/editor/editor-kit';
import type { Discussion, ReviewItem, Severity } from '@/types/annotations';

function PlateWrapper({ children }: { children: ReactNode }) {
  const editor = usePlateEditor({ plugins: editorPlugins });
  return <Plate editor={editor}>{children}</Plate>;
}

function makeAnchor(paragraphId = 'p-1') {
  return {
    paragraphId,
    startOffset: 0,
    endOffset: 10,
    exact: 'test text',
    prefix: 'before ',
    suffix: ' after',
  };
}

function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    type: 'discussion',
    id: 'd-1',
    anchor: makeAnchor(),
    author: 'ai',
    text: 'This clause is ambiguous.',
    quotedText: 'reasonable efforts',
    replies: [],
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    type: 'reviewItem',
    id: 'r-1',
    anchor: makeAnchor(),
    author: 'ai',
    action: 'replace',
    originalText: 'the Company shall notify',
    suggestedText: 'the Company shall promptly notify',
    rationale: 'Adds time obligation.',
    severity: 'major',
    clause: 'Section 3.2',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SeverityBadge', () => {
  it.each<[Severity, string]>([
    ['critical', 'bg-red-100'],
    ['major', 'bg-amber-100'],
    ['minor', 'bg-blue-100'],
    ['info', 'bg-gray-100'],
  ])('shows correct color class for %s', (severity, expectedClass) => {
    render(<SeverityBadge severity={severity} />);
    const badge = screen.getByTestId('severity-badge');
    expect(badge.className).toContain(expectedClass);
    expect(badge.textContent).toBe(severity);
  });
});

describe('AuthorBadge', () => {
  it('renders "Perry" for AI author', () => {
    render(<AuthorBadge author="ai" />);
    expect(screen.getByText('Perry')).toBeTruthy();
  });

  it('renders "You" for user author', () => {
    render(<AuthorBadge author="user" />);
    expect(screen.getByText('You')).toBeTruthy();
  });
});

describe('SuggestionCard', () => {
  it('renders original and suggested text', () => {
    const item = makeReviewItem();
    render(
      <SuggestionCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('original-text').textContent).toBe(
      'the Company shall notify',
    );
    expect(screen.getByTestId('suggested-text').textContent).toBe(
      'the Company shall promptly notify',
    );
  });

  it('fires onAccept with correct ID', () => {
    const onAccept = vi.fn();
    render(
      <SuggestionCard
        item={makeReviewItem({ id: 'r-42' })}
        isSelected={false}
        onClick={vi.fn()}
        onAccept={onAccept}
        onReject={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('accept-button'));
    expect(onAccept).toHaveBeenCalledWith('r-42');
  });

  it('fires onReject with correct ID', () => {
    const onReject = vi.fn();
    render(
      <SuggestionCard
        item={makeReviewItem({ id: 'r-42' })}
        isSelected={false}
        onClick={vi.fn()}
        onAccept={vi.fn()}
        onReject={onReject}
      />,
    );
    fireEvent.click(screen.getByTestId('reject-button'));
    expect(onReject).toHaveBeenCalledWith('r-42');
  });

  it('disables accept/reject buttons when status is not pending', () => {
    render(
      <SuggestionCard
        item={makeReviewItem({ status: 'accepted' })}
        isSelected={false}
        onClick={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('accept-button')).toBeDisabled();
    expect(screen.getByTestId('reject-button')).toBeDisabled();
  });
});

describe('CommentCard', () => {
  it('renders author badge and comment text', () => {
    render(
      <CommentCard
        discussion={makeDiscussion()}
        isSelected={false}
        onClick={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText('Perry')).toBeTruthy();
    expect(screen.getByText('This clause is ambiguous.')).toBeTruthy();
  });

  it('renders quoted text with visual distinction', () => {
    render(
      <CommentCard
        discussion={makeDiscussion()}
        isSelected={false}
        onClick={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    const quoted = screen.getByTestId('quoted-text');
    expect(quoted.textContent).toBe('reasonable efforts');
    expect(quoted.className).toContain('border-l-2');
    expect(quoted.className).toContain('italic');
  });
});

describe('SidebarHeader', () => {
  it('shows item count', () => {
    render(
      <SidebarHeader
        itemCount={5}
        activeFilter="all"
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('item-count').textContent).toBe('5');
  });

  it('renders filter tabs (All, Comments, Suggestions)', () => {
    render(
      <SidebarHeader
        itemCount={0}
        activeFilter="all"
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('filter-tab-all')).toBeTruthy();
    expect(screen.getByTestId('filter-tab-comment')).toBeTruthy();
    expect(screen.getByTestId('filter-tab-suggestion')).toBeTruthy();
  });

  it('uses singular "item" for count of 1', () => {
    render(
      <SidebarHeader
        itemCount={1}
        activeFilter="all"
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('item-count').textContent).toBe('1');
  });
});

// --- Adversarial Tests ---

describe('Adversarial: SidebarPanel', () => {
  beforeEach(() => {
    useAnnotationStore.setState({
      discussions: [],
      reviewItems: [],
      selectedCardId: null,
      filterType: 'all',
      isReviewLoading: false,
    });
  });

  it('shows empty state when no annotations exist', () => {
    render(
      <PlateWrapper>
        <SidebarPanel />
      </PlateWrapper>,
    );
    expect(screen.getByTestId('empty-state').textContent).toBe(
      'No items to review',
    );
  });
});

describe('Adversarial: SuggestionCard', () => {
  it('renders delete action (no suggestedText) without crash', () => {
    const item = makeReviewItem({
      action: 'delete',
      suggestedText: '',
    });
    render(
      <SuggestionCard
        item={item}
        isSelected={false}
        onClick={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('suggestion-card')).toBeTruthy();
    expect(screen.getByText('(delete)')).toBeTruthy();
  });

  it('handles rejected status — buttons disabled', () => {
    render(
      <SuggestionCard
        item={makeReviewItem({ status: 'rejected' })}
        isSelected={false}
        onClick={vi.fn()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('accept-button')).toBeDisabled();
    expect(screen.getByTestId('reject-button')).toBeDisabled();
  });
});

describe('Adversarial: CommentCard', () => {
  it('handles 2000-char comment without breaking layout', () => {
    const longText = 'A'.repeat(2000);
    render(
      <CommentCard
        discussion={makeDiscussion({ text: longText })}
        isSelected={false}
        onClick={vi.fn()}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(longText)).toBeTruthy();
  });
});
