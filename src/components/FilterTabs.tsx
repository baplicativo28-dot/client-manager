import type { FilterTab } from '../types';

interface Props {
  activeTab: FilterTab;
  onTabChange: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
}

const tabs: FilterTab[] = ['Todos', 'Ativos', 'Expirando', 'Expirados', 'Em Confianca', 'Desativados'];

export function FilterTabs({ activeTab, onTabChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === tab
              ? 'bg-accent text-white'
              : 'bg-card border border-border text-text hover:bg-gray-50'
          }`}
        >
          {tab}
          <span className="ml-1.5 text-xs opacity-75">({counts[tab]})</span>
        </button>
      ))}
    </div>
  );
}
