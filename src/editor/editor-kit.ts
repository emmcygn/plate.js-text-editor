import { ParagraphPlugin } from 'platejs/react';
import {
  HeadingPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list/react';
import {
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,
} from '@platejs/table/react';
import { CommentPlugin } from '@platejs/comment/react';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { HighlightPlugin } from '@/editor/plugins/highlight-plugin';
import { CommentHighlightPlugin } from '@/editor/plugins/comment-leaf';
import { SuggestionLeaf } from '@/editor/plugins/suggestion-leaf';

export const editorPlugins = [
  HeadingPlugin,
  ParagraphPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  ListPlugin,
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin,
  CommentPlugin,
  // TODO: Add multi-user support — currentUserId should come from auth context, not hardcoded.
  SuggestionPlugin.configure({
    options: {
      currentUserId: 'user-1',
      isSuggesting: false,
    },
  }).extend({
    render: { node: SuggestionLeaf },
  }),
  CommentHighlightPlugin,
  HighlightPlugin,
];
