import type { FilterType } from '@/lib/annotations/store';

const TABS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Comments', value: 'comment' },
  { label: 'Suggestions', value: 'suggestion' },
];

interface SidebarHeaderProps {
  itemCount: number;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function SidebarHeader({
  itemCount,
  activeFilter,
  onFilterChange,
}: SidebarHeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-base font-bold text-gray-800"
          data-testid="sidebar-title"
        >
          Review
        </h2>
        <span
          className="text-sm font-semibold text-gray-500 bg-gray-200 rounded-full px-2.5 py-0.5"
          data-testid="item-count"
        >
          {itemCount}
        </span>
      </div>
      <div className="flex gap-1 border-b border-gray-200" data-testid="filter-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`px-3 py-1.5 text-sm transition-colors ${
              activeFilter === tab.value
                ? 'font-semibold text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onFilterChange(tab.value)}
            data-testid={`filter-tab-${tab.value}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
