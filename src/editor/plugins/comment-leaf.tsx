import { createSlatePlugin } from 'platejs';
import { type PlateLeafProps, toTPlatePlugin } from 'platejs/react';

/**
 * Renders comment-highlighted text with a yellow background.
 *
 * The decoration logic (scanning for `comment_*` keys) lives in
 * PlateEditorContent's `decorate` prop. This plugin only handles
 * the leaf rendering when `commentHighlight: true` is on a decorated range.
 */
function CommentHighlightLeaf({ children, leaf }: PlateLeafProps) {
  const typedLeaf = leaf as { commentHighlight?: boolean };
  if (typedLeaf.commentHighlight) {
    return (
      <span
        style={{
          backgroundColor: '#fef9c3',
          borderBottom: '2px solid #fde047',
        }}
      >
        {children}
      </span>
    );
  }
  return <>{children}</>;
}

const BaseCommentHighlightPlugin = createSlatePlugin({
  key: 'commentHighlight',
  node: { isLeaf: true },
});

export const CommentHighlightPlugin = toTPlatePlugin(BaseCommentHighlightPlugin, {
  render: {
    node: CommentHighlightLeaf,
  },
});
