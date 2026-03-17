import { describe, it, expect } from 'vitest';
import { fuzzyFindInText } from '../fuzzy-find';

describe('fuzzyFindInText', () => {
  // ─── 1. Single occurrence ───────────────────────────────────────────
  describe('single occurrence', () => {
    it('returns the correct index for a unique substring', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      expect(fuzzyFindInText(text, 'brown fox', '', '')).toBe(10);
    });

    it('returns 0 when the match is at the start', () => {
      const text = 'Hello world, goodbye world';
      expect(fuzzyFindInText(text, 'Hello', '', '')).toBe(0);
    });
  });

  // ─── 2. Multiple occurrences, no context ────────────────────────────
  describe('multiple occurrences, no context', () => {
    it('returns first occurrence when prefix and suffix are both empty', () => {
      const text = 'cat dog cat dog cat';
      expect(fuzzyFindInText(text, 'cat', '', '')).toBe(0);
    });

    it('returns first occurrence when prefix and suffix are both empty strings', () => {
      const text = 'abc abc abc';
      const firstIdx = text.indexOf('abc');
      expect(fuzzyFindInText(text, 'abc', '', '')).toBe(firstIdx);
    });
  });

  // ─── 3. "the Company" disambiguation ───────────────────────────────
  describe('"the Company" disambiguation with 3 occurrences', () => {
    const text =
      'Section 1. The directors of the Company shall convene annually. ' +
      'Section 2. The shareholders of the Company shall receive dividends. ' +
      'Section 3. The officers of the Company shall report quarterly.';

    it('picks the second occurrence using prefix context', () => {
      // We want "the Company" in Section 2
      const exact = 'the Company';
      const prefix = 'The shareholders of ';
      const suffix = ' shall receive';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // The second occurrence is after "shareholders of "
      const expectedIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(expectedIdx);
    });

    it('picks the third occurrence using different context', () => {
      const exact = 'the Company';
      const prefix = 'The officers of ';
      const suffix = ' shall report';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const firstIdx = text.indexOf(exact);
      const secondIdx = text.indexOf(exact, firstIdx + 1);
      const thirdIdx = text.indexOf(exact, secondIdx + 1);
      expect(idx).toBe(thirdIdx);
    });

    it('picks the first occurrence with its context', () => {
      const exact = 'the Company';
      const prefix = 'The directors of ';
      const suffix = ' shall convene';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(text.indexOf(exact));
    });
  });

  // ─── 4. Prefix-only disambiguation ─────────────────────────────────
  describe('prefix-only disambiguation', () => {
    it('disambiguates using only prefix when suffix is empty', () => {
      // Each "banana" has a UNIQUE prefix so the algorithm can differentiate
      const text = 'alpha banana cherry beta banana cherry gamma banana cherry';
      const exact = 'banana';
      // Only the third "banana" is preceded by "gamma "
      const prefix = 'gamma ';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const third = text.lastIndexOf(exact);
      expect(idx).toBe(third);
    });
  });

  // ─── 5. Suffix-only disambiguation ─────────────────────────────────
  describe('suffix-only disambiguation', () => {
    it('disambiguates using only suffix when prefix is empty', () => {
      const text = 'foo bar baz foo qux quux foo corge grault';
      const exact = 'foo';
      // The second "foo" is followed by " qux"
      const suffix = ' qux quux';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const first = text.indexOf(exact);
      const second = text.indexOf(exact, first + 1);
      expect(idx).toBe(second);
    });
  });

  // ─── 6. No match ───────────────────────────────────────────────────
  describe('no match', () => {
    it('returns -1 when exact text is not in the haystack', () => {
      const text = 'Hello world';
      expect(fuzzyFindInText(text, 'goodbye', '', '')).toBe(-1);
    });

    it('returns -1 for a near-miss with one wrong character', () => {
      const text = 'the Compan';
      expect(fuzzyFindInText(text, 'the Company', '', '')).toBe(-1);
    });
  });

  // ─── 7. Empty exact string ─────────────────────────────────────────
  describe('empty exact string', () => {
    it('returns -1 for empty exact', () => {
      expect(fuzzyFindInText('any text here', '', 'prefix', 'suffix')).toBe(-1);
    });

    it('returns -1 for empty exact with empty context', () => {
      expect(fuzzyFindInText('any text here', '', '', '')).toBe(-1);
    });
  });

  // ─── 8. Exact string at very start of text ─────────────────────────
  describe('exact at very start of text', () => {
    it('finds match at index 0 with empty prefix', () => {
      const text = 'target word is here and target word is there';
      const exact = 'target word';
      const suffix = ' is here';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      expect(idx).toBe(0);
    });

    it('finds match at index 0 when prefix is provided but no text precedes', () => {
      const text = 'target other target';
      const exact = 'target';
      // Prefix context "XYZ" doesn't match anything before index 0
      // But suffix " other" matches only the first occurrence
      const idx = fuzzyFindInText(text, exact, 'XYZ', ' other');
      expect(idx).toBe(0);
    });
  });

  // ─── 9. Exact string at very end of text ────────────────────────────
  describe('exact at very end of text', () => {
    it('finds the last occurrence when suffix matches empty/end', () => {
      const text = 'start target middle target end target';
      const exact = 'target';
      // Last occurrence: suffix is empty string (end of text)
      // Prefix "end " matches the text before the last occurrence
      const prefix = 'end ';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const lastIdx = text.lastIndexOf(exact);
      expect(idx).toBe(lastIdx);
    });

    it('handles match at the very last character', () => {
      const text = 'abcX defX gX';
      const exact = 'X';
      const prefix = 'g';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      expect(idx).toBe(text.length - 1);
    });
  });

  // ─── 10. Overlapping occurrences ────────────────────────────────────
  describe('overlapping occurrences', () => {
    it('finds "aa" at indices 0 and 1 in "aaa" — picks best by context', () => {
      const text = 'aaa';
      const exact = 'aa';
      // No context → first occurrence
      expect(fuzzyFindInText(text, exact, '', '')).toBe(0);
    });

    it('disambiguates overlapping matches using suffix', () => {
      const text = 'aaa';
      const exact = 'aa';
      // Second "aa" starts at index 1 and is followed by "" (end)
      // First "aa" starts at index 0 and is followed by "a"
      // suffix "a" matches the first occurrence's suffix
      expect(fuzzyFindInText(text, exact, '', 'a')).toBe(0);
      // With prefix "a", the second occurrence (idx=1) has "a" before it
      expect(fuzzyFindInText(text, exact, 'a', '')).toBe(1);
    });

    it('finds all overlapping occurrences of "aba" in "ababa"', () => {
      const text = 'ababa';
      const exact = 'aba';
      // Occurrences at index 0 and 2
      // Suffix "ba" matches occurrence at index 0 (followed by "ba")
      expect(fuzzyFindInText(text, exact, '', 'ba')).toBe(0);
      // Prefix "ab" matches occurrence at index 2 (preceded by "ab")
      expect(fuzzyFindInText(text, exact, 'ab', '')).toBe(2);
    });
  });

  // ─── 11. Special characters ─────────────────────────────────────────
  describe('special characters', () => {
    it('handles regex metacharacters in exact string', () => {
      const text = 'price is $100.00 (USD) and price is $200.00 (EUR)';
      const exact = '$100.00 (USD)';
      expect(fuzzyFindInText(text, exact, '', '')).toBe(9);
    });

    it('handles brackets and special chars in prefix/suffix', () => {
      const text = '[Section 1] the Company [Section 2] the Company [Section 3]';
      const exact = 'the Company';
      const prefix = '[Section 2] ';
      const suffix = ' [Section 3]';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles dollar signs, quotes, and backslashes', () => {
      const text = 'value is "\\$50" and value is "\\$100"';
      const exact = 'value is';
      const prefix = '';
      const suffix = ' "\\$100"';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles newlines and tabs in text', () => {
      const text = 'line1\nthe Company\toperates\nline2\nthe Company\tgrows';
      const exact = 'the Company';
      const suffix = '\tgrows';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 12. Long context strings ──────────────────────────────────────
  describe('long context strings (100+ chars)', () => {
    it('correctly scores with long prefix/suffix that fully matches', () => {
      const longBefore = 'A'.repeat(150);
      const longAfter = 'B'.repeat(150);
      const text =
        'X'.repeat(50) +
        'target' +
        'Y'.repeat(50) +
        longBefore +
        'target' +
        longAfter;
      const exact = 'target';
      const prefix = longBefore;
      const suffix = longAfter;
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('scores long context that gradually diverges', () => {
      // Both occurrences have similar but not identical surrounding text
      // Divergence starts at different distances from the match
      const sharedPrefix = 'SHARED_PREFIX_' + 'X'.repeat(50);
      const text =
        sharedPrefix +
        'AAAA' +
        'target' +
        'CCCC' +
        'noise'.repeat(20) +
        sharedPrefix +
        'BBBB' +
        'target' +
        'DDDD';
      const exact = 'target';
      // We want the second occurrence: prefix ends with "BBBB"
      const prefix = sharedPrefix + 'BBBB';
      const suffix = 'DDDD';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 13. Identical surrounding text except one char ─────────────────
  describe('identical surrounding text except one char', () => {
    it('differentiates when only the last prefix char differs', () => {
      // Two occurrences with almost identical prefix, differing in the char right before
      const text = 'contextA_target noise contextB_target';
      const exact = 'target';
      const prefix = 'contextB_';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('differentiates when only the first suffix char differs', () => {
      const text = 'target_suffixA noise target_suffixB';
      const exact = 'target';
      const suffix = '_suffixB';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('correctly picks match when prefix differs by only 1 char deep in context', () => {
      // Both contexts are identical except one character 5 chars back from the match
      const text = 'hello1world_target blah hello2world_target';
      const exact = 'target';
      // prefix "hello2world_" matches second occurrence exactly
      // prefix "hello1world_" would match first occurrence exactly
      // The scoring is right-to-left greedy, so "world_" (6 chars) matches both equally
      // At char 7, "2" vs "1" — second occurrence wins
      const prefix = 'hello2world_';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('returns first when both contexts are truly identical', () => {
      // Edge: two occurrences with perfectly identical surrounding text
      const text = 'same_ctx target same_ctx target same_ctx';
      const exact = 'target';
      const prefix = 'same_ctx ';
      const suffix = ' same_ctx';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // Both score equally, so first occurrence wins (> not >=)
      const firstIdx = text.indexOf(exact);
      expect(idx).toBe(firstIdx);
    });
  });

  // ─── 14. Case sensitivity ──────────────────────────────────────────
  describe('case sensitivity', () => {
    it('does NOT match "The Company" when searching for "the Company"', () => {
      const text = 'The Company is great';
      expect(fuzzyFindInText(text, 'the Company', '', '')).toBe(-1);
    });

    it('finds "the Company" but not "the company" (lowercase c)', () => {
      const text = 'first the company then the Company last';
      const exact = 'the Company';
      const idx = fuzzyFindInText(text, exact, '', '');
      expect(idx).toBe(text.indexOf('the Company'));
      // Verify it's case-sensitive: "the company" is at index 6
      expect(idx).not.toBe(6);
    });

    it('disambiguates case-different occurrences correctly', () => {
      const text = 'see THE COMPANY here and the Company there';
      expect(fuzzyFindInText(text, 'THE COMPANY', '', '')).toBe(4);
      expect(fuzzyFindInText(text, 'the Company', '', '')).toBe(25);
    });
  });

  // ─── Additional adversarial tests ──────────────────────────────────
  describe('adversarial edge cases', () => {
    it('handles exact string equal to entire text', () => {
      const text = 'entire text';
      expect(fuzzyFindInText(text, text, '', '')).toBe(0);
    });

    it('handles single-character exact string', () => {
      const text = 'abcabc';
      expect(fuzzyFindInText(text, 'a', '', '')).toBe(0);
      expect(fuzzyFindInText(text, 'a', 'abc', '')).toBe(3);
    });

    it('handles when text is shorter than exact', () => {
      expect(fuzzyFindInText('ab', 'abc', '', '')).toBe(-1);
    });

    it('handles empty text', () => {
      expect(fuzzyFindInText('', 'anything', '', '')).toBe(-1);
    });

    it('handles prefix/suffix that are longer than text before/after match', () => {
      const text = 'XY target ZW';
      const exact = 'target';
      const prefix = 'A'.repeat(100) + 'XY ';
      const suffix = ' ZW' + 'B'.repeat(100);
      // Should still match correctly — only compares up to min length
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(3);
    });

    it('context scoring breaks on first mismatch (greedy sequential)', () => {
      // This tests the implementation's greedy right-to-left scoring behavior.
      // Occurrence 1: prefix "XYZABC" → from right: C,B,A match (3 chars), then X≠Z
      // Occurrence 2: prefix "QRZABC" → from right: C,B,A match (3 chars), then Z=Z (4), R≠Y
      // With prefix "QYZABC": Occ1 right-to-left C,B,A,Y = 4; Occ2 right-to-left C,B,A,Z≠Y = 3
      // So occurrence 1 should win
      const text = 'XYZABC_target_noise_QRZABC_target_end';
      const exact = 'target';
      const prefix = 'QYZABC_';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      // Occ1 (idx=7): textBefore="XYZABC_", prefix="QYZABC_"
      //   right-to-left: _=_ (1), C=C (2), B=B (3), A=A (4), Z=Z (5), Y=Y (6), X≠Q → score=6
      // Occ2 (idx=27): textBefore="XYZABC_target_noise_QRZABC_", prefix="QYZABC_"
      //   right-to-left: _=_ (1), C=C (2), B=B (3), A=A (4), Z=Z (5), R≠Y → score=5
      // So occurrence 1 wins with score 6
      expect(idx).toBe(7);
    });

    it('returns first when no context matches either occurrence', () => {
      const text = 'hello world hello world';
      const exact = 'hello';
      // Completely wrong context that doesn't match anything nearby
      const prefix = 'ZZZZZ';
      const suffix = 'QQQQQ';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // Both score 0, first wins
      expect(idx).toBe(0);
    });

    it('handles many occurrences and picks the right one', () => {
      // 10 occurrences of "item" with unique contexts
      const parts = Array.from(
        { length: 10 },
        (_, i) => `ctx${i}_item_end${i}`,
      );
      const text = parts.join(' ');
      const exact = 'item';
      // We want the 7th occurrence (index 6, ctx6_item_end6)
      const prefix = 'ctx6_';
      const suffix = '_end6';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // Find the actual index of the 7th "item"
      let pos = -1;
      for (let i = 0; i <= 6; i++) {
        pos = text.indexOf('item', pos + 1);
      }
      expect(idx).toBe(pos);
    });
  });
});

describe('fuzzyFindInText — adversarial stress tests', () => {
  // ─── 1. Near-miss prefix/suffix ─────────────────────────────────────
  describe('near-miss prefix/suffix differing by last character only', () => {
    it('picks correct occurrence when prefixes differ by only the last char', () => {
      // Two occurrences with prefixes "...SAME_TEXTA " vs "...SAME_TEXTB "
      const text =
        'SAME_TEXTA the Company shall act. SAME_TEXTB the Company shall grow.';
      const exact = 'the Company';
      // Target the second occurrence: prefix ends with "B "
      const prefix = 'SAME_TEXTB ';
      const suffix = '';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('picks correct occurrence when suffixes differ by only the first char', () => {
      const text =
        'the Company Xrest of suffix here. the Company Yrest of suffix here.';
      const exact = 'the Company';
      const prefix = '';
      const suffix = ' Yrest of suffix here.';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 2. Unicode ────────────────────────────────────────────────────
  describe('Unicode: emoji, CJK, diacritics', () => {
    it('finds emoji in text and returns correct byte-naive index', () => {
      const text = 'before 🎉 middle 🎉 after';
      const exact = '🎉';
      const prefix = 'middle ';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const secondIdx = text.indexOf('🎉', text.indexOf('🎉') + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles CJK characters with correct offsets', () => {
      const text = '会社の代表は会社の取締役です。会社の株主も重要です。';
      const exact = '会社';
      const prefix = '。';
      const suffix = 'の株主';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // Third occurrence of 会社
      let pos = -1;
      for (let i = 0; i < 3; i++) {
        pos = text.indexOf('会社', pos + 1);
      }
      expect(idx).toBe(pos);
    });

    it('handles combining diacritics', () => {
      const text = 'café résumé café naïve café über';
      const exact = 'café';
      const prefix = 'naïve ';
      const suffix = ' über';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const lastIdx = text.lastIndexOf('café');
      expect(idx).toBe(lastIdx);
    });

    it('handles mixed emoji and ASCII in prefix/suffix context', () => {
      const text = 'start 🔥 target 💧 noise 🌈 target 🎯 end';
      const exact = 'target';
      const prefix = '🌈 ';
      const suffix = ' 🎯';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 3. Very long repeated patterns (50+ occurrences) ──────────────
  describe('"the Company" repeated 50+ times with unique contexts', () => {
    it('finds the correct occurrence among 50 with unique prefix/suffix', () => {
      const parts: string[] = [];
      for (let i = 0; i < 50; i++) {
        parts.push(`Section ${i.toString().padStart(2, '0')}. The directors of the Company shall perform duty${i.toString().padStart(2, '0')}.`);
      }
      const text = parts.join(' ');
      const exact = 'the Company';
      const targetIdx = 37;
      const prefix = `Section ${targetIdx.toString().padStart(2, '0')}. The directors of `;
      const suffix = ` shall perform duty${targetIdx.toString().padStart(2, '0')}.`;
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // Find the 38th occurrence (0-indexed 37)
      let pos = -1;
      for (let i = 0; i <= targetIdx; i++) {
        pos = text.indexOf(exact, pos + 1);
      }
      expect(idx).toBe(pos);
    });

    it('finds the LAST occurrence among 100 repetitions', () => {
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push(`[${i}] the Company`);
      }
      const text = parts.join(' ');
      const exact = 'the Company';
      const prefix = '[99] ';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const lastIdx = text.lastIndexOf(exact);
      expect(idx).toBe(lastIdx);
    });
  });

  // ─── 4. Partial prefix overlap (self-referential context) ──────────
  describe('prefix text contains the exact text (self-referential)', () => {
    it('handles when prefix itself contains the exact string', () => {
      // "the Company" appears in the prefix context AND in the match
      const text =
        'when the Company agreed, the Company shall act. later the Company promised, the Company shall grow.';
      const exact = 'the Company';
      // We want the 4th occurrence. Its prefix contains "the Company" itself.
      const prefix = 'later the Company promised, ';
      const suffix = ' shall grow.';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      let pos = -1;
      for (let i = 0; i < 4; i++) {
        pos = text.indexOf(exact, pos + 1);
      }
      expect(idx).toBe(pos);
    });

    it('handles when exact string is a substring of the prefix', () => {
      const text = 'XX AB XX AB XX';
      const exact = 'AB';
      // prefix ends with "XX " — unique to second occurrence
      const prefix = 'AB XX ';
      const suffix = ' XX';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 5. Single character exact ─────────────────────────────────────
  describe('single character exact in text with many instances', () => {
    it('finds correct "a" among 100 "a"s using unique numeric context', () => {
      // Build text with unique numeric separators: "[000]a[001]a[002]a..."
      // Each separator is unique, guaranteeing unique prefix/suffix context
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push(`[${i.toString().padStart(3, '0')}]`);
      }
      const text = parts.join('a');
      // Now text = "[000]a[001]a[002]a..." — 99 "a"s between 100 brackets
      const exact = 'a';
      // Target the 50th "a" (0-indexed 49)
      let targetPos = -1;
      let count = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === 'a') {
          count++;
          if (count === 50) {
            targetPos = i;
            break;
          }
        }
      }
      expect(targetPos).toBeGreaterThan(0);
      const prefix = text.slice(Math.max(0, targetPos - 20), targetPos);
      const suffix = text.slice(targetPos + 1, targetPos + 21);
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(targetPos);
    });

    it('returns first "a" when all contexts are identical', () => {
      const text = 'aaaaa';
      const exact = 'a';
      // prefix "a", suffix "a" — multiple matches score equally
      // When tied, first wins
      // idx=0: prefix score 0 (nothing before), suffix "a" matches 1 char = score 1
      // idx=1: prefix "a"="a" score 1, suffix "a" vs "a" score 1 = score 2
      // idx=2: prefix "a" vs last of "aa" = score 1, suffix "a" vs "a" = score 1 = score 2
      // idx=3: same as 2 = score 2
      // idx=4: prefix "a" vs last of "aaaa" = score 1, suffix empty = score 1
      // Multiple tie at score 2, first tie-winner is idx=1
      const idx = fuzzyFindInText(text, exact, 'a', 'a');
      expect(idx).toBe(1);
    });
  });

  // ─── 6. Whitespace-heavy ───────────────────────────────────────────
  describe('whitespace-heavy text', () => {
    it('handles multiple consecutive spaces', () => {
      const text = 'word     the Company     next     the Company     last';
      const exact = 'the Company';
      const prefix = 'next     ';
      const suffix = '     last';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles tabs and newlines mixed with content', () => {
      const text = 'line1\t\tthe Company\n\n\nline2\t\tthe Company\n\n\nline3';
      const exact = 'the Company';
      const prefix = 'line2\t\t';
      const suffix = '\n\n\nline3';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('exact string is only whitespace', () => {
      const text = 'a   b   c';
      const exact = '   ';
      const prefix = 'a';
      const suffix = 'b';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(1);
    });
  });

  // ─── 7. Empty text ─────────────────────────────────────────────────
  describe('empty text with non-empty exact', () => {
    it('returns -1 for empty text', () => {
      expect(fuzzyFindInText('', 'search', 'prefix', 'suffix')).toBe(-1);
    });

    it('returns -1 for empty text with empty context', () => {
      expect(fuzzyFindInText('', 'x', '', '')).toBe(-1);
    });
  });

  // ─── 8. Exact string is the entire text ────────────────────────────
  describe('exact string equals the entire text', () => {
    it('returns 0 when exact is the full text with no prefix/suffix', () => {
      const text = 'This is the complete document text.';
      expect(fuzzyFindInText(text, text, '', '')).toBe(0);
    });

    it('returns 0 when exact is the full text with non-matching context', () => {
      const text = 'Full document.';
      expect(fuzzyFindInText(text, text, 'nonexistent', 'nonexistent')).toBe(0);
    });

    it('returns 0 for single-character text equaling exact', () => {
      expect(fuzzyFindInText('X', 'X', '', '')).toBe(0);
    });
  });

  // ─── 9. Adversarial scoring: prefix vs suffix disagreement ─────────
  describe('adversarial scoring: prefix and suffix disagree', () => {
    it('total score decides when prefix favors one and suffix favors another', () => {
      // Occurrence 1: good prefix match (5 chars), bad suffix match (1 char)
      // Occurrence 2: bad prefix match (1 char), good suffix match (5 chars)
      // Both score 6 total — first wins on tie
      const text = 'ABCDE_target_F_____ _____target_FGHIJ';
      const exact = 'target';
      const prefix = 'ABCDE_';
      const suffix = '_FGHIJ';
      fuzzyFindInText(text, exact, prefix, suffix);
      // Occ1 (idx=6): prefix "ABCDE_" matches 6/6, suffix "_F_____" matches "_F" = 2 → total 8
      // Occ2 (idx=25): prefix "_____" vs "ABCDE_" right-to-left: _≠_ ... let me recalculate
      // Actually let me construct this more carefully
      const text2 = 'PPPPP_target_QQQQQ gap RRRRR_target_SSSSS';
      const exact2 = 'target';
      // Want: prefix matches occ1 better, suffix matches occ2 better, but suffix wins overall
      const prefix2 = 'PPPPP_'; // matches occ1 perfectly: 6 chars
      const suffix2 = '_SSSSS'; // matches occ2 perfectly: 6 chars
      const idx2 = fuzzyFindInText(text2, exact2, prefix2, suffix2);
      // Occ1: prefix score 6, suffix "_Q" vs "_S" → "_" matches = 1, Q≠S → score = 6+1=7
      // Occ2: prefix "R_" vs "P_" right-to-left: _=_, R≠P → score 1, suffix 6 → total 7
      // Tied at 7, first wins
      const firstIdx = text2.indexOf(exact2);
      expect(idx2).toBe(firstIdx);
    });

    it('suffix breaks tie when prefix scores are equal', () => {
      const text = 'ZZZ_target_AAA gap ZZZ_target_BBB';
      const exact = 'target';
      const prefix = 'ZZZ_'; // Both match equally: 4 chars
      const suffix = '_BBB'; // Only second matches: 4 chars vs 1 char ("_" then A≠B)
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      // Occ1: prefix 4, suffix "_AAA" vs "_BBB" → _ matches, A≠B → suffix 1, total 5
      // Occ2: prefix 4, suffix "_BBB" vs "_BBB" → 4, total 8
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 10. Legal document patterns ───────────────────────────────────
  describe('legal document patterns', () => {
    it('disambiguates "(i)" / "(ii)" / "(iii)" numbered items', () => {
      const text =
        'The Board shall: (i) appoint the Company to manage assets; ' +
        '(ii) direct the Company to file reports; ' +
        '(iii) require the Company to maintain records.';
      const exact = 'the Company';
      const prefix = '(ii) direct ';
      const suffix = ' to file reports';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      let pos = -1;
      for (let i = 0; i < 2; i++) {
        pos = text.indexOf(exact, pos + 1);
      }
      expect(idx).toBe(pos);
    });

    it('handles "Section 4.2(a)" cross-references', () => {
      const text =
        'Per Section 4.2(a), the Company shall comply. ' +
        'Per Section 4.2(b), the Company shall report. ' +
        'Per Section 4.2(c), the Company shall disclose.';
      const exact = 'the Company';
      const prefix = 'Section 4.2(c), ';
      const suffix = ' shall disclose';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      let pos = -1;
      for (let i = 0; i < 3; i++) {
        pos = text.indexOf(exact, pos + 1);
      }
      expect(idx).toBe(pos);
    });

    it('distinguishes "the Company" / "the Purchaser" / "the Board" in dense legal text', () => {
      const text =
        'the Company and the Purchaser agree that the Board shall oversee the Company ' +
        'and the Purchaser. the Board shall require the Company to deliver.';
      const exact = 'the Company';
      // We want the 3rd "the Company" (the last one)
      const prefix = 'require ';
      const suffix = ' to deliver';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const lastIdx = text.lastIndexOf(exact);
      expect(idx).toBe(lastIdx);
    });

    it('handles "WHEREAS" recitals with repeated phrasing', () => {
      const text =
        'WHEREAS, the Company desires to issue shares; and ' +
        'WHEREAS, the Company desires to raise capital; and ' +
        'WHEREAS, the Company desires to expand operations;';
      const exact = 'the Company desires';
      const prefix = '';
      const suffix = ' to raise capital';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 11. Regex metacharacters everywhere ───────────────────────────
  describe('regex metacharacters treated as literals', () => {
    it('finds "(.*?)" as literal text', () => {
      const text = 'pattern (.*?) here and another (.*?) there';
      const exact = '(.*?)';
      const prefix = 'another ';
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('finds "\\d+" as literal text', () => {
      const text = 'regex \\d+ test regex \\d+ end';
      const exact = '\\d+';
      const suffix = ' end';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles "$^.*+?()[]{}|" in exact, prefix, and suffix', () => {
      const text = 'A $^.*+?()[]{}| B $^.*+?()[]{}| C';
      const exact = '$^.*+?()[]{}|';
      const prefix = 'B ';
      const suffix = ' C';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 12. Maximum-length context ────────────────────────────────────
  describe('maximum-length context (1000+ characters)', () => {
    it('handles 1000-char prefix and suffix without crashing', () => {
      const longPrefix = 'P'.repeat(1000);
      const longSuffix = 'S'.repeat(1000);
      const text = 'Q'.repeat(500) + 'target' + 'R'.repeat(500) + ' ' +
        longPrefix + 'target' + longSuffix;
      const exact = 'target';
      const idx = fuzzyFindInText(text, exact, longPrefix, longSuffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles 5000-char prefix with no performance degradation', () => {
      const hugePrefix = 'X'.repeat(5000);
      const text = hugePrefix + 'needle' + 'Y'.repeat(5000);
      const exact = 'needle';
      const start = performance.now();
      const idx = fuzzyFindInText(text, exact, hugePrefix, 'Y'.repeat(5000));
      const elapsed = performance.now() - start;
      expect(idx).toBe(5000);
      expect(elapsed).toBeLessThan(1000); // Should be well under 1 second
    });
  });

  // ─── 13. Null bytes and control characters ─────────────────────────
  describe('null bytes and control characters', () => {
    it('handles null bytes in text', () => {
      const text = 'before\0target\0after before\0target\0end';
      const exact = 'target';
      const suffix = '\0end';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('handles control characters \\x01 through \\x1f', () => {
      const text = 'a\x01\x02target\x03\x04 b\x01\x02target\x05\x06';
      const exact = 'target';
      const suffix = '\x05\x06';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('exact string contains null byte', () => {
      const text = 'hello\0world and hello\0world again';
      const exact = 'hello\0world';
      const suffix = ' again';
      const idx = fuzzyFindInText(text, exact, '', suffix);
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });
  });

  // ─── 14. Needle at every possible position ─────────────────────────
  describe('needle at every possible position', () => {
    it('scores ALL positions of "X" in "AXBXCXDXEX" and picks the right one', () => {
      const text = 'AXBXCXDXEX';
      const exact = 'X';
      // X appears at positions 1, 3, 5, 7, 9
      // Target position 5 (between C and D)
      const prefix = 'C';
      const suffix = 'D';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(5);
    });

    it('finds correct position in alternating pattern with 26 positions', () => {
      // "AXB XC XD X...Z X" — X between every letter pair
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let text = '';
      for (let i = 0; i < letters.length; i++) {
        text += letters[i] + '|';
      }
      // text = "A|B|C|D|...|Z|"
      const exact = '|';
      // Target the one after 'M' (position 13*2 - 1 = 25)
      // Actually: A(0) |(1) B(2) |(3) C(4) |(5) ...
      // After M (index 12): M is at position 24, | is at position 25
      const prefix = 'M';
      const suffix = 'N';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(25);
    });

    it('correctly scores every position when exact appears at regular intervals', () => {
      // 20 occurrences of "." with unique single-char contexts
      const segments = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t';
      const exact = '.';
      // Target the "." between "n" and "o"
      const prefix = 'n';
      const suffix = 'o';
      const idx = fuzzyFindInText(segments, exact, prefix, suffix);
      const expectedIdx = segments.indexOf('n.o') + 1;
      expect(idx).toBe(expectedIdx);
    });
  });

  // ─── 15. Bonus: Pathological/degenerate inputs ─────────────────────
  describe('pathological and degenerate inputs', () => {
    it('handles exact string repeated with no separators', () => {
      // "abcabcabcabc..." — overlapping occurrences of "abcabc"
      const text = 'abc'.repeat(20);
      const exact = 'abcabc';
      // Target occurrence starting at position 6 (3rd "abc" pair)
      const prefix = text.slice(0, 6);
      const idx = fuzzyFindInText(text, exact, prefix, '');
      expect(idx).toBe(6);
    });

    it('handles very long exact string (1000 chars)', () => {
      const exact = 'W'.repeat(1000);
      const text = 'A'.repeat(500) + exact + 'B'.repeat(500) + exact + 'C'.repeat(500);
      const prefix = 'B'.repeat(500);
      const idx = fuzzyFindInText(text, exact, prefix, '');
      const secondIdx = text.indexOf(exact, text.indexOf(exact) + 1);
      expect(idx).toBe(secondIdx);
    });

    it('prefix and suffix are identical to each other', () => {
      const text = 'SAME target SAME gap SAME target SAME';
      const exact = 'target';
      // Both occurrences have identical prefix/suffix — first should win
      const prefix = 'SAME ';
      const suffix = ' SAME';
      const idx = fuzzyFindInText(text, exact, prefix, suffix);
      expect(idx).toBe(text.indexOf(exact));
    });

    it('text is one character repeated 10000 times, exact is single char', () => {
      const text = 'a'.repeat(10000);
      const exact = 'a';
      // No way to disambiguate — all score equally, first should win
      const idx = fuzzyFindInText(text, exact, 'a', 'a');
      // idx=1 has both prefix and suffix match = 2 (same as many others)
      // idx=0 has only suffix match = 1
      // idx=1 should win (first to reach max score)
      expect(idx).toBe(1);
    });
  });
});
