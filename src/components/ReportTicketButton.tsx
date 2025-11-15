/**
 * Botón flotante para reportar problemas
 * Visible para todos los usuarios (asesores y admins)
 */

import React, { useState } from "react";
import { Bug, ListChecks } from "lucide-react";
import { TicketFormModal } from "./TicketFormModal";
import { MyTicketsPanel } from "./MyTicketsPanel";

export function ReportTicketButton() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMyTicketsOpen, setIsMyTicketsOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* Botón flotante con menú desplegable */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Menu items (shown when showMenu is true) */}
        {showMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-56 mb-2">
            <button
              onClick={() => {
                setIsFormOpen(true);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              <Bug size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Reportar Problema</span>
            </button>
            <button
              onClick={() => {
                setIsMyTicketsOpen(true);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              <ListChecks size={18} className="text-green-600" />
              <span className="text-sm font-medium text-gray-700">Mis Reportes</span>
            </button>
          </div>
        )}

        {/* Main button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2
                     bg-gradient-to-r from-blue-500 to-blue-600
                     hover:from-blue-600 hover:to-blue-700
                     text-white px-5 py-3 rounded-full shadow-lg
                     hover:shadow-xl transform hover:scale-105
                     transition-all duration-200
                     font-medium text-sm"
          title="Reportes y problemas"
        >
          <Bug size={20} />
          <span className="hidden sm:inline">Reportes</span>
        </button>
      </div>

      {/* Modal del formulario */}
      <TicketFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
      />

      {/* Panel de Mis Tickets */}
      <MyTicketsPanel
        isOpen={isMyTicketsOpen}
        onClose={() => setIsMyTicketsOpen(false)}
      />
    </>
  );
}
