/**
 * Score how well the text surrounding a match position aligns with
 * the expected prefix and suffix context.
 *
 * Compares the end of `prefix` against the end of `textBefore` (right-to-left),
 * and the start of `suffix` against the start of `textAfter` (left-to-right).
 *
 * Optimized overload: when called with (text, matchIndex, exactLength, prefix, suffix),
 * indexes directly into `text` without allocating substrings.
 */
export function scoreContext(
  text: string,
  matchIndex: number,
  exactLength: number,
  prefix: string,
  suffix: string,
): number {
  let score = 0;

  // Score prefix: compare right-to-left from the match start
  const prefixLen = Math.min(prefix.length, matchIndex);
  for (let i = 1; i <= prefixLen; i++) {
    if (prefix[prefix.length - i] === text[matchIndex - i]) {
      score++;
    } else {
      break;
    }
  }

  // Score suffix: compare left-to-right from the match end
  const afterStart = matchIndex + exactLength;
  const suffixLen = Math.min(suffix.length, text.length - afterStart);
  for (let i = 0; i < suffixLen; i++) {
    if (suffix[i] === text[afterStart + i]) {
      score++;
    } else {
      break;
    }
  }

  return score;
}

/**
 * Find the best occurrence of `exact` within `text` using prefix/suffix
 * context scoring for disambiguation.
 *
 * Algorithm:
 * 1. Find all indices where `exact` appears in `text`.
 * 2. Score each by how well surrounding text matches prefix/suffix.
 * 3. Return the index of the highest-scoring match.
 *    - If all scores are 0 (no context available), returns first occurrence.
 *    - If `exact` is not found at all, returns -1.
 */
export function fuzzyFindInText(
  text: string,
  exact: string,
  prefix: string,
  suffix: string,
): number {
  if (exact.length === 0) return -1;

  // Collect all occurrence indices
  const indices: number[] = [];
  let searchFrom = 0;
  while (searchFrom <= text.length - exact.length) {
    const idx = text.indexOf(exact, searchFrom);
    if (idx === -1) break;
    indices.push(idx);
    searchFrom = idx + 1;
  }

  if (indices.length === 0) return -1;
  if (indices.length === 1) return indices[0];

  // No context to disambiguate — return first
  if (prefix.length === 0 && suffix.length === 0) return indices[0];

  // Score each occurrence — indexes directly into text, no substring allocation
  let bestIndex = indices[0];
  let bestScore = -1;

  for (const idx of indices) {
    const score = scoreContext(text, idx, exact.length, prefix, suffix);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return bestIndex;
}
