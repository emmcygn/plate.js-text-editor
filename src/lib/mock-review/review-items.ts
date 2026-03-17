import type { Discussion, ReviewItem } from '@/types/annotations';

/**
 * 10 mock AI review items targeting specific clauses in the
 * Peec AI GmbH Shareholders' Agreement. All `exact`, `prefix`, and `suffix`
 * values are verified against the actual DOCX output.
 *
 * Uses `__unresolved__` paragraph IDs — the anchoring system's Tier 3
 * (full-document fallback) resolves these using prefix/suffix context.
 */
const UNRESOLVED = '__unresolved__';

const timestamp = (minuteOffset: number) =>
  new Date(Date.UTC(2026, 2, 15, 10, minuteOffset, 0)).toISOString();

// --- 6 Suggestions ---

export const REVIEW_SUGGESTIONS: ReviewItem[] = [
  {
    type: 'reviewItem',
    id: 'review-sug-1',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 12,
      exact: 'best efforts',
      prefix: 'Therefore, the Company shall use its ',
      suffix: ' to\nadopting a climate policy, as defined by measuring the Compa',
    },
    author: 'ai',
    action: 'replace',
    originalText: 'best efforts',
    suggestedText: 'commercially reasonable efforts',
    rationale:
      '"Best efforts" is the highest standard of obligation under German law and may expose the Company to litigation risk. "Commercially reasonable efforts" is the market-standard formulation in venture financing agreements and provides a more balanced obligation.',
    severity: 'critical',
    clause: 'Section 4.4 (Sustainability / ESG)',
    status: 'pending',
    createdAt: timestamp(0),
  },
  {
    type: 'reviewItem',
    id: 'review-sug-2',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 25,
      exact: 'same terms and conditions',
      prefix: 'capital increase under the ',
      suffix: ' on which the respective capital increase is based. The precedi',
    },
    author: 'ai',
    action: 'replace',
    originalText: 'same terms and conditions',
    suggestedText: 'substantially similar terms and conditions',
    rationale:
      '"Same terms and conditions" requires exact replication which may be impractical in capital increases with multiple tranches. "Substantially similar" provides reasonable flexibility while preserving economic equivalence for existing shareholders.',
    severity: 'major',
    clause: 'Section 11.1 (Subscription Rights)',
    status: 'pending',
    createdAt: timestamp(1),
  },
  {
    type: 'reviewItem',
    id: 'review-sug-3',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 15,
      exact: 'bona-fide offer',
      prefix: 'affiliated with any Shareholder renders a ',
      suffix: ' to acquire all Shares, or more than 75% of the assets or busi',
    },
    author: 'ai',
    action: 'replace',
    originalText: 'bona-fide offer',
    suggestedText: 'bona-fide, written offer',
    rationale:
      'Requiring the offer to be in written form provides an evidentiary record and prevents disputes about whether an oral indication constitutes a binding trigger for drag-along rights. This is standard practice in German M&A transactions.',
    severity: 'critical',
    clause: 'Section 10.1 (Drag-Along Right)',
    status: 'pending',
    createdAt: timestamp(2),
  },
  {
    type: 'reviewItem',
    id: 'review-sug-4',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 14,
      exact: 'six (6) months',
      prefix: 'by the Company by notarial deed within ',
      suffix: ' as of the date when all Shareholders gain knowledge of the re',
    },
    author: 'ai',
    action: 'replace',
    originalText: 'six (6) months',
    suggestedText: 'three (3) months',
    rationale:
      'A six-month acceptance window for reverse vesting share transfer creates prolonged uncertainty for the departing founder. Shortening to three months aligns with standard German GmbH practice and accelerates post-departure resolution.',
    severity: 'minor',
    clause: 'Section 13.5 (Reverse Vesting — Acceptance)',
    status: 'pending',
    createdAt: timestamp(5),
  },
  {
    type: 'reviewItem',
    id: 'review-sug-5',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 20,
      exact: 'shall have the right',
      prefix: 'If legally permissible, each Holder of Preferred ',
      suffix: ' to convert its Preferred Shares at any time into Common Share',
    },
    author: 'ai',
    action: 'replace',
    originalText: 'shall have the right',
    suggestedText: 'shall have the irrevocable right',
    rationale:
      'Adding "irrevocable" clarifies that the conversion right cannot be withdrawn by majority amendment under Section 19. This protects preferred shareholders from dilution of their conversion option through future agreement changes.',
    severity: 'minor',
    clause: 'Section 11.4 (Conversion)',
    status: 'pending',
    createdAt: timestamp(7),
  },
  {
    type: 'reviewItem',
    id: 'review-sug-6',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 8,
      exact: 'pro rata',
      prefix: 'up to such Acquisition Limit ',
      suffix: ' in the ratio of the number of Shares held by other Shareholde',
    },
    author: 'ai',
    action: 'insert',
    originalText: 'pro rata',
    suggestedText: 'pro rata (on a fully-diluted basis)',
    rationale:
      'The "pro rata" calculation basis is ambiguous — it could be computed on issued shares or fully-diluted capital. Specifying "fully-diluted basis" avoids disputes when virtual shares or convertible instruments are outstanding.',
    severity: 'major',
    clause: 'Section 7.2 (Right of First Refusal)',
    status: 'pending',
    createdAt: timestamp(4),
  },
];

// --- 4 Comments (Discussions) ---

export const REVIEW_DISCUSSIONS: Discussion[] = [
  {
    type: 'discussion',
    id: 'review-cmt-1',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 11,
      exact: 'the Company',
      prefix: 'the only managing directors of ',
      suffix: ' and as such exempted from the restrictions of Sec. 181',
    },
    author: 'ai',
    text: 'This is the first substantive reference to "the Company" (Peec AI GmbH) outside the definitions. With 191 occurrences in this agreement, the reader must constantly determine whether "the Company" refers to Peec AI GmbH as a legal entity, its management, or its business operations. Consider adding a parenthetical clarification at first use in each major section.',
    quotedText: 'the Company',
    replies: [],
    resolvedAt: null,
    createdAt: timestamp(3),
  },
  {
    type: 'discussion',
    id: 'review-cmt-2',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 30,
      exact: 'at least once every quarter of',
      prefix: 'shall meet in person or by video conference ',
      suffix: ' a business year and shall be free to schedule additional meet',
    },
    author: 'ai',
    text: 'Quarterly advisory board meetings may be insufficient during critical growth phases (fundraising, M&A activity). Consider requiring monthly meetings during any active financing round or Exit Transaction negotiation, with quarterly as the baseline.',
    quotedText: 'at least once every quarter of',
    replies: [],
    resolvedAt: null,
    createdAt: timestamp(6),
  },
  {
    type: 'discussion',
    id: 'review-cmt-3',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 49,
      exact: 'in a manner and in a format approved by Singular',
      prefix: 'a diversity and inclusion (DEI) policy;\n\nin each case ',
      suffix: '.\n\nCompany will review and optimize the aforementioned measur',
    },
    author: 'ai',
    text: 'Granting a single investor (Singular) unilateral approval rights over ESG reporting format could create operational friction. Consider requiring approval by the Preferred Majority instead, or specifying that Singular\'s approval shall not be unreasonably withheld.',
    quotedText: 'in a manner and in a format approved by Singular',
    replies: [],
    resolvedAt: null,
    createdAt: timestamp(8),
  },
  {
    type: 'discussion',
    id: 'review-cmt-4',
    anchor: {
      paragraphId: UNRESOLVED,
      startOffset: 0,
      endOffset: 19,
      exact: 'twelve (12) months\u2019',
      prefix: 'Each Party hereto may terminate this Agreement with ',
      suffix: ' notice to the end of a calendar year, but in no event with e',
    },
    author: 'ai',
    text: 'A 12-month notice period for termination is unusually long for a shareholders\' agreement. Consider whether 6 months would be more practical, especially for minority investors who may need to exit. The long notice period, combined with the calendar year-end requirement, could effectively lock parties in for up to 23 months.',
    quotedText: 'twelve (12) months\u2019',
    replies: [],
    resolvedAt: null,
    createdAt: timestamp(9),
  },
];

/** All 10 review items combined for the injection pipeline. */
export const MOCK_REVIEW_ITEMS = {
  suggestions: REVIEW_SUGGESTIONS,
  discussions: REVIEW_DISCUSSIONS,
};
