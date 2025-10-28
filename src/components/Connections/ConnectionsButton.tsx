import React from 'react';
import './ConnectionsPanel.css';

interface ConnectionsButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ConnectionsButton({ isOpen, onToggle }: ConnectionsButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--ghost topbar-tab${isOpen ? ' is-active' : ''}`}
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls="connections-panel"
    >
      🔌 Conexiones
    </button>
  );
}
