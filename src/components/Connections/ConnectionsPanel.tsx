import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionsTabs } from './ConnectionsTabs';
import './ConnectionsPanel.css';

const BitrixSettings = React.lazy(() =>
  import('../Bitrix24Panel').then((module) => ({ default: module.Bitrix24Panel }))
);

const WhatsappSettings = React.lazy(() =>
  import('../WhatsAppConfig').then((module) => ({ default: module.WhatsAppConfigContent }))
);

type TabId = 'bitrix' | 'whatsapp';

interface ConnectionsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectionsPanel({ open, onClose }: ConnectionsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('bitrix');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousOverflow = useRef<string>('');

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = previousOverflow.current ?? '';
      return;
    }

    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      headingRef.current?.focus();
    }, 60);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow.current ?? '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setActiveTab('bitrix');
    }
  }, [open]);

  const tabs = useMemo(
    () => [
      { id: 'bitrix' as const, label: 'Bitrix24', icon: '🔗' },
      { id: 'whatsapp' as const, label: 'WhatsApp', icon: '📱' },
    ],
    []
  );

  if (!open) {
    return null;
  }

  return (
    <div className="connections-backdrop" role="presentation" onClick={onClose}>
      <aside
        id="connections-panel"
        className="connections-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connections-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="connections-panel__header">
          <div>
            <h2
              id="connections-panel-title"
              ref={headingRef}
              tabIndex={-1}
            >
              Conexiones
            </h2>
            <p className="text-sm text-slate-500">Gestiona Bitrix24 y WhatsApp sin salir del canvas.</p>
          </div>
          <button
            type="button"
            className="connections-panel__close"
            onClick={onClose}
            aria-label="Cerrar panel de conexiones"
          >
            ×
          </button>
        </header>

        <div className="connections-panel__body">
          <ConnectionsTabs tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} />

          <div className="connections-panel__content">
            <div className="connections-panel__scroll">
              <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando configuración...</div>}>
                {activeTab === 'bitrix' ? (
                  <div
                    id="connections-panel-bitrix"
                    role="tabpanel"
                    aria-labelledby="connections-tab-bitrix"
                    className="bitrix-panel"
                  >
                    <BitrixSettings />
                  </div>
                ) : (
                  <div
                    id="connections-panel-whatsapp"
                    role="tabpanel"
                    aria-labelledby="connections-tab-whatsapp"
                    className="whatsapp-panel"
                  >
                    <WhatsappSettings
                      headingId="connections-panel-whatsapp-heading"
                      className="whatsapp-panel"
                    />
                  </div>
                )}
              </Suspense>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
