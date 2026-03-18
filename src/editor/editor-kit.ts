import React from 'react';
import { ParagraphPlugin, type PlateElementProps } from 'platejs/react';
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

/**
 * Custom paragraph renderer — adds `index-entry` class for paragraphs
 * marked during DOCX import so CSS can render them in a two-column layout.
 */
export function ParagraphElement({ attributes, children, element }: PlateElementProps) {
  const el = element as Record<string, unknown>;
  const isIndex = el.indexEntry === true;
  const baseClass = ((attributes as Record<string, unknown>).className as string) || '';
  // Use <div> (not <p>) to avoid invalid DOM nesting — Plate sometimes
  // nests paragraph-type elements, and <p> inside <p> is invalid HTML.
  if (isIndex) {
    const props = { ...attributes, className: `${baseClass} index-entry`.trim() };
    return React.createElement('div', props, children);
  }
  return React.createElement('div', attributes, children);
}

function TableElement({ attributes, children }: PlateElementProps) {
  return React.createElement('table', attributes, React.createElement('tbody', null, children));
}

function TableRowElement({ attributes, children }: PlateElementProps) {
  return React.createElement('tr', attributes, children);
}

function TableCellElement({ attributes, children, element }: PlateElementProps) {
  const col = (element.colSpan ?? element.colspan) as number | undefined;
  const row = (element.rowSpan ?? element.rowspan) as number | undefined;
  const { colspan: _c, rowspan: _r, ...cleanAttrs } = attributes as Record<string, unknown>;
  const props = { ...cleanAttrs, ...(col ? { colSpan: col } : {}), ...(row ? { rowSpan: row } : {}) };
  return React.createElement('td', props, children);
}

function TableHeaderCellElement({ attributes, children, element }: PlateElementProps) {
  const col = (element.colSpan ?? element.colspan) as number | undefined;
  const row = (element.rowSpan ?? element.rowspan) as number | undefined;
  const { colspan: _c, rowspan: _r, ...cleanAttrs } = attributes as Record<string, unknown>;
  const props = { ...cleanAttrs, ...(col ? { colSpan: col } : {}), ...(row ? { rowSpan: row } : {}) };
  return React.createElement('th', props, children);
}

export const editorPlugins = [
  HeadingPlugin,
  ParagraphPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  ListPlugin,
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableHeaderCellElement),
  CommentPlugin,
  // TODO: Add multi-user support — currentUserId should come from auth context, not hardcoded.
  SuggestionPlugin.configure({
    options: {
      currentUserId: 'user-1',
      isSuggesting: false,
    },
  }).withComponent(SuggestionLeaf),
  CommentHighlightPlugin,
  HighlightPlugin,
];
