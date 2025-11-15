/**
 * Panel de administración de tickets
 * Solo visible para admins
 * Muestra todos los tickets con filtros y opciones de gestión
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
  Send,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import axios from "axios";

interface Ticket {
  id: number;
  ticket_number: string;
  reporter_name: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  images: Array<{ path: string; filename: string }>;
  admin_comments: Array<{ author: string; comment: string; timestamp: string }>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  high_priority: number;
  last_24h: number;
}

interface AdminTicketsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminTicketsPanel({ isOpen, onClose }: AdminTicketsPanelProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTickets();
      fetchStats();
    }
  }, [isOpen, filterStatus, filterPriority]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterPriority !== "all") params.append("priority", filterPriority);

      const response = await axios.get(`/api/tickets/all?${params.toString()}`);
      setTickets(response.data.tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get("/api/tickets/stats/summary");
      setStats(response.data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const updateStatus = async (ticketId: number, newStatus: string) => {
    try {
      await axios.patch(`/api/tickets/${ticketId}/status`, { status: newStatus });
      fetchTickets();
      fetchStats();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const submitComment = async (ticketId: number) => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      await axios.post(`/api/tickets/${ticketId}/comment`, { comment: commentText });
      setCommentText("");
      fetchTickets();
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setSubmittingComment(false);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-100";
      case "medium":
        return "text-orange-600 bg-orange-100";
      case "low":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
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

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Media";
      case "low":
        return "Baja";
      default:
        return priority;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Panel de Reportes</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona todos los reportes de problemas
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
        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-gray-500">Pendientes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
              <div className="text-xs text-gray-500">En Progreso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              <div className="text-xs text-gray-500">Resueltos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.high_priority}</div>
              <div className="text-xs text-gray-500">Alta Prioridad</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.last_24h}</div>
              <div className="text-xs text-gray-500">Últimas 24h</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
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

          <div>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              No hay tickets con estos filtros
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map(ticket => (
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
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {getStatusLabel(ticket.status)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                            {getPriorityLabel(ticket.priority)}
                          </span>
                          {ticket.images.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <ImageIcon size={14} />
                              {ticket.images.length}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-gray-800 mb-1">
                          {ticket.title}
                        </h3>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{ticket.reporter_name}</span>
                          <span>•</span>
                          <span>{new Date(ticket.created_at).toLocaleDateString("es-PE")}</span>
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
                    <div className="border-t border-gray-200 p-4 space-y-4">
                      {/* Description */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Descripción:</h4>
                        <p className="text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
                      </div>

                      {/* Images */}
                      {ticket.images.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-700 mb-2">Capturas:</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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

                      {/* Status Actions */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Cambiar estado:</h4>
                        <div className="flex gap-2">
                          {ticket.status !== "pending" && (
                            <button
                              onClick={() => updateStatus(ticket.id, "pending")}
                              className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 transition-colors"
                            >
                              Marcar Pendiente
                            </button>
                          )}
                          {ticket.status !== "in_progress" && (
                            <button
                              onClick={() => updateStatus(ticket.id, "in_progress")}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                            >
                              Marcar En Progreso
                            </button>
                          )}
                          {ticket.status !== "resolved" && (
                            <button
                              onClick={() => updateStatus(ticket.id, "resolved")}
                              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                            >
                              Marcar Resuelto
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Comments */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Comentarios del admin:</h4>

                        {/* Existing Comments */}
                        {ticket.admin_comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {ticket.admin_comments.map((comment, idx) => (
                              <div key={idx} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-gray-700">
                                    {comment.author}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(comment.timestamp).toLocaleString("es-PE")}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{comment.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Agregar un comentario..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            onKeyPress={e => {
                              if (e.key === "Enter" && !submittingComment) {
                                submitComment(ticket.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => submitComment(ticket.id)}
                            disabled={submittingComment || !commentText.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Resolved Info */}
                      {ticket.resolved_at && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-green-700">
                            <span className="font-medium">Resuelto por:</span>{" "}
                            {ticket.resolved_by_name || "Admin"}
                            <span className="mx-2">•</span>
                            <span>{new Date(ticket.resolved_at).toLocaleString("es-PE")}</span>
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
