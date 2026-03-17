import { useEditorRef } from 'platejs/react';
import { SuggestionPlugin } from '@platejs/suggestion/react';
import { useEditorPlugin } from 'platejs/react';

/**
 * Toolbar toggle for suggesting mode (track changes).
 * When active, all user edits create suggestion marks instead of direct changes.
 */
export function SuggestingToggle() {
  const editor = useEditorRef();
  const { getOption } = useEditorPlugin(SuggestionPlugin);
  const isSuggesting = getOption('isSuggesting');

  const handleToggle = () => {
    editor.setOption(SuggestionPlugin, 'isSuggesting', !isSuggesting);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      data-testid="suggesting-toggle"
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
        transition-colors duration-150
        ${isSuggesting
          ? 'bg-green-100 text-green-800 border border-green-300'
          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      <svg
        className="h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
        />
      </svg>
      {isSuggesting ? 'Suggesting' : 'Editing'}
    </button>
  );
}
