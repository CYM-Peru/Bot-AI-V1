/**
 * Panel "Mis Tickets" para usuarios
 * Muestra los tickets creados por el usuario actual
 */

import React, { useState, useEffect } from "react";
import { X, ExternalLink, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";

interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  category?: string;
  images: Array<{ path: string; filename: string }>;
  admin_comments: Array<{ author: string; comment: string; timestamp: string }>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface MyTicketsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyTicketsPanel({ isOpen, onClose }: MyTicketsPanelProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (isOpen) {
      fetchMyTickets();
    }
  }, [isOpen]);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/tickets/my");
      setTickets(response.data.tickets);
    } catch (error) {
      console.error("Error fetching my tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-100";
      case "in_progress":
        return "text-blue-600 bg-blue-100";
      case "resolved":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock size={16} className="text-yellow-600" />;
      case "in_progress":
        return <AlertCircle size={16} className="text-blue-600" />;
      case "resolved":
        return <CheckCircle size={16} className="text-green-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "in_progress":
        return "En Progreso";
      case "resolved":
        return "Resuelto";
      default:
        return status;
    }
  };

  const filteredTickets = filterStatus === "all"
    ? tickets
    : tickets.filter(t => t.status === filterStatus);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Mis Reportes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Consulta el estado de tus reportes de problemas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{tickets.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {tickets.filter(t => t.status === "pending").length}
            </div>
            <div className="text-xs text-gray-500">Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {tickets.filter(t => t.status === "in_progress").length}
            </div>
            <div className="text-xs text-gray-500">En Progreso</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {tickets.filter(t => t.status === "resolved").length}
            </div>
            <div className="text-xs text-gray-500">Resueltos</div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="resolved">Resuelto</option>
          </select>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              {filterStatus === "all"
                ? "No has creado ningún reporte aún"
                : "No hay tickets con este estado"}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="border border-gray-200 rounded-lg bg-white hover:shadow-md transition-shadow"
                >
                  {/* Ticket Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() =>
                      setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-medium text-blue-600">
                            {ticket.ticket_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(ticket.status)}`}>
                            {getStatusIcon(ticket.status)}
                            {getStatusLabel(ticket.status)}
                          </span>
                          {ticket.category && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {ticket.category}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-gray-800 mb-1">
                          {ticket.title}
                        </h3>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{new Date(ticket.created_at).toLocaleDateString("es-PE", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}</span>
                          {ticket.admin_comments.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{ticket.admin_comments.length} comentario{ticket.admin_comments.length !== 1 ? "s" : ""}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {expandedTicket === ticket.id ? (
                          <ChevronUp size={20} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedTicket === ticket.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      {/* Description */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Descripción:</h4>
                        <p className="text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
                      </div>

                      {/* Images */}
                      {ticket.images.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Capturas adjuntas:</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {ticket.images.map((img, idx) => (
                              <a
                                key={idx}
                                href={img.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group"
                              >
                                <img
                                  src={img.path}
                                  alt={`Captura ${idx + 1}`}
                                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center">
                                  <ExternalLink
                                    size={24}
                                    className="text-white opacity-0 group-hover:opacity-100"
                                  />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin Comments */}
                      {ticket.admin_comments.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">
                            Comentarios del equipo de soporte:
                          </h4>
                          <div className="space-y-2">
                            {ticket.admin_comments.map((comment, idx) => (
                              <div key={idx} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-blue-900">
                                    {comment.author}
                                  </span>
                                  <span className="text-xs text-blue-600">
                                    {new Date(comment.timestamp).toLocaleString("es-PE")}
                                  </span>
                                </div>
                                <p className="text-sm text-blue-800">{comment.comment}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resolved Info */}
                      {ticket.resolved_at && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="font-semibold text-sm text-green-900">
                              Resuelto
                            </span>
                          </div>
                          <p className="text-sm text-green-700">
                            {new Date(ticket.resolved_at).toLocaleString("es-PE")}
                          </p>
                        </div>
                      )}

                      {/* No comments yet */}
                      {ticket.admin_comments.length === 0 && ticket.status !== "resolved" && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-700">
                            <span className="font-medium">Pendiente de revisión.</span> El equipo de soporte revisará tu reporte pronto.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
