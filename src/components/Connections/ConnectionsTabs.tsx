import React from 'react';

export interface ConnectionsTabItem {
  id: 'bitrix' | 'whatsapp';
  label: string;
  icon?: React.ReactNode;
}

interface ConnectionsTabsProps {
  tabs: ConnectionsTabItem[];
  activeTab: ConnectionsTabItem['id'];
  onSelect: (id: ConnectionsTabItem['id']) => void;
}

export function ConnectionsTabs({ tabs, activeTab, onSelect }: ConnectionsTabsProps) {
  return (
    <div className="conn-tabs" role="tablist" aria-orientation="vertical">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`connections-panel-${tab.id}`}
            id={`connections-tab-${tab.id}`}
            className={`conn-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
