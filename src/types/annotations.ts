/** Locates a text range within the document using paragraph ID + offsets + context. */
export interface Anchor {
  paragraphId: string;
  startOffset: number;
  endOffset: number;
  /** The exact selected text. */
  exact: string;
  /** ~32 chars before the selection for fuzzy recovery. */
  prefix: string;
  /** ~32 chars after the selection for fuzzy recovery. */
  suffix: string;
}

export type AnnotationType = 'discussion' | 'reviewItem';
export type AuthorType = 'user' | 'ai';
export type SuggestionAction = 'replace' | 'insert' | 'delete';
export type Severity = 'critical' | 'major' | 'minor' | 'info';
export type ReviewItemStatus = 'pending' | 'accepted' | 'rejected';

export interface Reply {
  id: string;
  author: AuthorType;
  text: string;
  createdAt: string;
}

export interface Discussion {
  type: 'discussion';
  id: string;
  anchor: Anchor;
  author: AuthorType;
  text: string;
  quotedText: string;
  replies: Reply[];
  resolvedAt: string | null;
  createdAt: string;
}

export interface ReviewItem {
  type: 'reviewItem';
  id: string;
  anchor: Anchor;
  author: AuthorType;
  action: SuggestionAction;
  originalText: string;
  suggestedText: string;
  rationale: string;
  severity: Severity;
  clause: string;
  status: ReviewItemStatus;
  createdAt: string;
}

export type Annotation = Discussion | ReviewItem;
