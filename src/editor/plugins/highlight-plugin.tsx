import type { TRange } from 'platejs';
import type { PlateLeafProps } from 'platejs/react';
import { createSlatePlugin } from 'platejs';
import { toTPlatePlugin } from 'platejs/react';

/** Compare two Slate points. Returns -1, 0, or 1. */
function comparePoints(
  a: { path: number[]; offset: number },
  b: { path: number[]; offset: number },
): number {
  for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
    if (a.path[i] < b.path[i]) return -1;
    if (a.path[i] > b.path[i]) return 1;
  }
  if (a.path.length < b.path.length) return -1;
  if (a.path.length > b.path.length) return 1;
  if (a.offset < b.offset) return -1;
  if (a.offset > b.offset) return 1;
  return 0;
}

/** Compute the intersection of two ranges, or null if they don't overlap. */
export function rangeIntersection(a: TRange, b: TRange): TRange | null {
  const aStart = comparePoints(a.anchor, a.focus) <= 0 ? a.anchor : a.focus;
  const aEnd = comparePoints(a.anchor, a.focus) <= 0 ? a.focus : a.anchor;
  const bStart = comparePoints(b.anchor, b.focus) <= 0 ? b.anchor : b.focus;
  const bEnd = comparePoints(b.anchor, b.focus) <= 0 ? b.focus : b.anchor;

  const start = comparePoints(aStart, bStart) >= 0 ? aStart : bStart;
  const end = comparePoints(aEnd, bEnd) <= 0 ? aEnd : bEnd;

  if (comparePoints(start, end) > 0) return null;
  return { anchor: start, focus: end };
}

/**
 * Persistent highlight leaf — stays visible while a sidebar card is selected.
 * Also renders accept/reject flash highlights that fade out over 3 seconds.
 */
function HighlightLeaf({ children, leaf }: PlateLeafProps) {
  const typedLeaf = leaf as {
    highlight?: boolean;
    flash?: boolean;
    flashType?: 'accepted' | 'rejected';
  };

  if (typedLeaf.flash && typedLeaf.flashType) {
    const bg = typedLeaf.flashType === 'accepted'
      ? 'rgba(34, 197, 94, 0.35)'   // green
      : 'rgba(239, 68, 68, 0.25)';  // red
    return (
      <span
        className="suggestion-flash"
        style={{ backgroundColor: bg, borderRadius: '2px' }}
      >
        {children}
      </span>
    );
  }

  if (typedLeaf.highlight) {
    return (
      <span
        style={{
          backgroundColor: 'rgba(250, 204, 21, 0.4)',
          borderRadius: '2px',
        }}
      >
        {children}
      </span>
    );
  }
  return <>{children}</>;
}

const BaseHighlightPlugin = createSlatePlugin({
  key: 'highlight',
  node: { isLeaf: true },
});

/**
 * Plugin for highlight RENDERING only. The decorate logic lives in
 * PlateEditorContent via the `decorate` prop on PlateContent, because
 * decorations that depend on external state (Zustand) need React
 * reactivity to trigger re-renders — `editor.api.redecorate()` is
 * not available in Plate.js v52.
 */
export const HighlightPlugin = toTPlatePlugin(BaseHighlightPlugin, {
  render: {
    node: HighlightLeaf,
  },
});
