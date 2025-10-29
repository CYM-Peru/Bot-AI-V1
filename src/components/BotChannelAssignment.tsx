import { useState } from 'react';
import type { FlowChannelAssignment, WhatsAppNumberAssignment, ChannelType } from '../flow/types';

interface BotChannelAssignmentProps {
  flowId: string;
  flowName: string;
  assignments: FlowChannelAssignment[];
  availableNumbers: WhatsAppNumberAssignment[];
  onUpdate: (assignments: FlowChannelAssignment[]) => void;
}

const CHANNEL_ICONS: Record<ChannelType, string> = {
  whatsapp: '📱',
  facebook: '💬',
  instagram: '📷',
  telegram: '✈️',
};

const CHANNEL_NAMES: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook Messenger',
  instagram: 'Instagram Direct',
  telegram: 'Telegram',
};

export function BotChannelAssignment({
  flowName,
  assignments = [],
  availableNumbers,
  onUpdate,
}: BotChannelAssignmentProps) {
  const [showPanel, setShowPanel] = useState(false);

  const whatsappAssignment = assignments.find((a) => a.channelType === 'whatsapp');
  const assignedNumbers = whatsappAssignment?.whatsappNumbers || [];

  const getAssignmentSummary = () => {
    if (assignedNumbers.length === 0) {
      return 'Sin asignar';
    }
    const numberNames = assignedNumbers
      .map((numberId) => availableNumbers.find((n) => n.numberId === numberId)?.displayName)
      .filter(Boolean);
    if (numberNames.length === 0) return 'Sin asignar';
    if (numberNames.length === 1) return numberNames[0];
    return `${numberNames.length} números`;
  };

  const toggleNumber = (numberId: string) => {
    const currentAssignments = [...assignments];
    let whatsappIdx = currentAssignments.findIndex((a) => a.channelType === 'whatsapp');

    if (whatsappIdx === -1) {
      currentAssignments.push({
        channelType: 'whatsapp',
        whatsappNumbers: [numberId],
        enabled: true,
      });
    } else {
      const currentNumbers = currentAssignments[whatsappIdx].whatsappNumbers || [];
      if (currentNumbers.includes(numberId)) {
        currentAssignments[whatsappIdx] = {
          ...currentAssignments[whatsappIdx],
          whatsappNumbers: currentNumbers.filter((id) => id !== numberId),
        };
      } else {
        currentAssignments[whatsappIdx] = {
          ...currentAssignments[whatsappIdx],
          whatsappNumbers: [...currentNumbers, numberId],
        };
      }
    }

    onUpdate(currentAssignments);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition"
      >
        <span className="text-base">📱</span>
        <span>Canal:</span>
        <span className="font-semibold text-emerald-600">
          {getAssignmentSummary()}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${showPanel ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">
                Asignación de Canal
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bot: <span className="font-medium">{flowName}</span>
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* WhatsApp Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{CHANNEL_ICONS.whatsapp}</span>
                  <span className="text-sm font-medium text-slate-700">
                    {CHANNEL_NAMES.whatsapp}
                  </span>
                </div>

                {availableNumbers.length === 0 ? (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                    No hay números de WhatsApp configurados. Ve a Configuración para agregar números.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableNumbers.map((number) => {
                      const isAssigned = assignedNumbers.includes(number.numberId);
                      return (
                        <label
                          key={number.numberId}
                          className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleNumber(number.numberId)}
                            className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">
                              {number.displayName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {number.phoneNumber}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Future channels placeholder */}
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-400 italic">
                  Próximamente: Facebook, Instagram, Telegram
                </p>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
              <button
                onClick={() => setShowPanel(false)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
