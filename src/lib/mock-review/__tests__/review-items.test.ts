import { describe, it, expect } from 'vitest';
import {
  REVIEW_SUGGESTIONS,
  REVIEW_DISCUSSIONS,
  MOCK_REVIEW_ITEMS,
} from '../review-items';

const ALL_ITEMS = [...REVIEW_SUGGESTIONS, ...REVIEW_DISCUSSIONS];

describe('Mock review data — counts', () => {
  it('has exactly 6 suggestions', () => {
    expect(REVIEW_SUGGESTIONS).toHaveLength(6);
  });

  it('has exactly 4 discussions', () => {
    expect(REVIEW_DISCUSSIONS).toHaveLength(4);
  });

  it('has exactly 10 items total via MOCK_REVIEW_ITEMS', () => {
    expect(
      MOCK_REVIEW_ITEMS.suggestions.length +
        MOCK_REVIEW_ITEMS.discussions.length,
    ).toBe(10);
  });
});

describe('Mock review data — type discrimination', () => {
  it('all suggestions have type "reviewItem"', () => {
    for (const s of REVIEW_SUGGESTIONS) {
      expect(s.type).toBe('reviewItem');
    }
  });

  it('all discussions have type "discussion"', () => {
    for (const d of REVIEW_DISCUSSIONS) {
      expect(d.type).toBe('discussion');
    }
  });
});

describe('Mock review data — ID uniqueness', () => {
  it('all IDs across both arrays are unique', () => {
    const ids = ALL_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Mock review data — severity coverage', () => {
  it('suggestions contain at least 3 distinct severity values', () => {
    const severities = new Set(REVIEW_SUGGESTIONS.map((s) => s.severity));
    expect(severities.size).toBeGreaterThanOrEqual(3);
  });
});

describe('Mock review data — rationale quality', () => {
  it('every suggestion rationale is more than 50 characters', () => {
    for (const s of REVIEW_SUGGESTIONS) {
      expect(s.rationale.length).toBeGreaterThan(50);
    }
  });
});

describe('Mock review data — anchor structure', () => {
  it('every item has a valid anchor with correct types and ranges', () => {
    for (const item of ALL_ITEMS) {
      const { anchor } = item;
      expect(typeof anchor.paragraphId).toBe('string');
      expect(anchor.paragraphId.length).toBeGreaterThan(0);
      expect(anchor.startOffset).toBeGreaterThanOrEqual(0);
      expect(anchor.endOffset).toBeGreaterThan(anchor.startOffset);
      expect(typeof anchor.exact).toBe('string');
      expect(anchor.exact.length).toBeGreaterThan(0);
      expect(typeof anchor.prefix).toBe('string');
      expect(anchor.prefix.length).toBeGreaterThan(0);
      expect(typeof anchor.suffix).toBe('string');
      expect(anchor.suffix.length).toBeGreaterThan(0);
    }
  });
});

describe('Mock review data — suggestion text invariants', () => {
  it('originalText matches anchor.exact for every suggestion', () => {
    for (const s of REVIEW_SUGGESTIONS) {
      expect(s.originalText).toBe(s.anchor.exact);
    }
  });

  it('suggestedText differs from originalText for every suggestion', () => {
    for (const s of REVIEW_SUGGESTIONS) {
      expect(s.suggestedText).not.toBe(s.originalText);
    }
  });
});

describe('Mock review data — discussion text quality', () => {
  it('every discussion text is more than 50 characters', () => {
    for (const d of REVIEW_DISCUSSIONS) {
      expect(d.text.length).toBeGreaterThan(50);
    }
  });

  it('every discussion quotedText matches anchor.exact', () => {
    for (const d of REVIEW_DISCUSSIONS) {
      expect(d.quotedText).toBe(d.anchor.exact);
    }
  });
});

describe('Mock review data — author field', () => {
  it('every item has author "ai"', () => {
    for (const item of ALL_ITEMS) {
      expect(item.author).toBe('ai');
    }
  });
});

describe('Mock review data — suggestion actions', () => {
  it('every suggestion has a valid action (replace | insert | delete)', () => {
    const validActions = new Set(['replace', 'insert', 'delete']);
    for (const s of REVIEW_SUGGESTIONS) {
      expect(validActions.has(s.action)).toBe(true);
    }
  });

  it('at least one suggestion has action "insert"', () => {
    const hasInsert = REVIEW_SUGGESTIONS.some((s) => s.action === 'insert');
    expect(hasInsert).toBe(true);
  });
});

describe('Mock review data — status fields', () => {
  it('every suggestion has status "pending"', () => {
    for (const s of REVIEW_SUGGESTIONS) {
      expect(s.status).toBe('pending');
    }
  });

  it('every discussion has resolvedAt === null', () => {
    for (const d of REVIEW_DISCUSSIONS) {
      expect(d.resolvedAt).toBeNull();
    }
  });

  it('every discussion has empty replies array', () => {
    for (const d of REVIEW_DISCUSSIONS) {
      expect(d.replies).toEqual([]);
    }
  });
});

describe('Mock review data — timestamps', () => {
  it('every createdAt is a valid ISO date', () => {
    for (const item of ALL_ITEMS) {
      const parsed = Date.parse(item.createdAt);
      expect(Number.isNaN(parsed)).toBe(false);
    }
  });

  it('all createdAt values are unique', () => {
    const timestamps = ALL_ITEMS.map((item) => item.createdAt);
    expect(new Set(timestamps).size).toBe(timestamps.length);
  });
});

describe('Mock review data — clause field', () => {
  it('every suggestion has a non-empty clause string containing "Section"', () => {
    for (const s of REVIEW_SUGGESTIONS) {
      expect(s.clause.length).toBeGreaterThan(0);
      expect(s.clause).toContain('Section');
    }
  });
});

describe('Mock review data — prefix/suffix disambiguation length', () => {
  it('every anchor prefix is at least 20 characters', () => {
    for (const item of ALL_ITEMS) {
      expect(item.anchor.prefix.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('every anchor suffix is at least 20 characters', () => {
    for (const item of ALL_ITEMS) {
      expect(item.anchor.suffix.length).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('Mock review data — duplicate exact text disambiguation', () => {
  it('items sharing the same exact text have different prefix OR suffix', () => {
    const byExact = new Map<
      string,
      Array<{ prefix: string; suffix: string }>
    >();
    for (const item of ALL_ITEMS) {
      const { exact, prefix, suffix } = item.anchor;
      if (!byExact.has(exact)) {
        byExact.set(exact, []);
      }
      byExact.get(exact)!.push({ prefix, suffix });
    }

    for (const [exact, anchors] of byExact) {
      if (anchors.length <= 1) continue;
      // Every pair must differ in prefix or suffix
      for (let i = 0; i < anchors.length; i++) {
        for (let j = i + 1; j < anchors.length; j++) {
          const differs =
            anchors[i].prefix !== anchors[j].prefix ||
            anchors[i].suffix !== anchors[j].suffix;
          expect(
            differs,
            `Duplicate exact text "${exact}" at indices ${i} and ${j} must have different prefix or suffix`,
          ).toBe(true);
        }
      }
    }
  });
});
