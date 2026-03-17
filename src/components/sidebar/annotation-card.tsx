import type { Annotation } from '@/types/annotations';
import { CommentCard } from '@/components/sidebar/comment-card';
import { SuggestionCard } from '@/components/sidebar/suggestion-card';

interface AnnotationCardProps {
  annotation: Annotation;
  isSelected: boolean;
  onClick: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onResolve: (id: string) => void;
}

export function AnnotationCard({
  annotation,
  isSelected,
  onClick,
  onAccept,
  onReject,
  onResolve,
}: AnnotationCardProps) {
  if (annotation.type === 'discussion') {
    return (
      <CommentCard
        discussion={annotation}
        isSelected={isSelected}
        onClick={onClick}
        onResolve={onResolve}
      />
    );
  }

  return (
    <SuggestionCard
      item={annotation}
      isSelected={isSelected}
      onClick={onClick}
      onAccept={onAccept}
      onReject={onReject}
    />
  );
}
