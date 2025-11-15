import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationSimulator, type SimulationMessage } from '../../runtime/simulator';
import { type Flow } from '../../flow/types';
import { MessageCircle, X, Send, RotateCcw, Zap } from 'lucide-react';

interface ChatSimulatorProps {
  flow: Flow;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSimulator({ flow, isOpen, onClose }: ChatSimulatorProps) {
  const [simulator, setSimulator] = useState<ConversationSimulator | null>(null);
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize simulator when flow changes or component opens
  useEffect(() => {
    if (isOpen && flow?.id) {
      initSimulator();
    }
  }, [isOpen, flow?.id]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const initSimulator = useCallback(async () => {
    setIsLoading(true);
    try {
      const flowProvider = {
        async getFlow(flowId: string) {
          return flowId === flow.id ? flow : null;
        },
      };

      const sim = new ConversationSimulator({ flowProvider });
      const state = await sim.start(flow.id);

      setSimulator(sim);
      setMessages(state.messages);
      setVariables(sim.getVariables());
    } catch (error) {
      console.error('[ChatSimulator] Error initializing:', error);
      setMessages([{
        id: 'error',
        timestamp: new Date().toISOString(),
        direction: 'outbound',
        content: {
          type: 'system',
          payload: {
            level: 'error',
            message: 'Error al iniciar el simulador. Verifica que el flujo tenga un nodo Start.'
          }
        }
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [flow]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !simulator || isLoading) return;

    const text = inputText.trim();
    setInputText('');
    setIsLoading(true);

    try {
      const state = await simulator.sendText(text);
      setMessages(state.messages);
      setVariables(simulator.getVariables());
    } catch (error) {
      console.error('[ChatSimulator] Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, simulator, isLoading]);

  const handleReset = useCallback(async () => {
    if (!simulator) return;
    setIsLoading(true);
    try {
      await simulator.reset();
      await initSimulator();
    } catch (error) {
      console.error('[ChatSimulator] Error resetting:', error);
    } finally {
      setIsLoading(false);
    }
  }, [simulator, initSimulator]);

  const handleButtonClick = useCallback(async (buttonId: string, buttonText: string) => {
    if (!simulator || isLoading) return;
    setIsLoading(true);

    try {
      const state = await simulator.clickButton(buttonId, buttonText);
      setMessages(state.messages);
      setVariables(simulator.getVariables());
    } catch (error) {
      console.error('[ChatSimulator] Error clicking button:', error);
    } finally {
      setIsLoading(false);
    }
  }, [simulator, isLoading]);

  const renderMessage = (msg: SimulationMessage) => {
    const content = msg.content;

    // Outbound messages (from bot)
    if (msg.direction === 'outbound') {
      if (content.type === 'text') {
        return (
          <div key={msg.id} className="flex justify-start mb-3">
            <div className="max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-sm">
              <div className="whitespace-pre-wrap">{content.text}</div>
              <div className="text-[10px] text-slate-400 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      }

      if (content.type === 'buttons') {
        return (
          <div key={msg.id} className="flex justify-start mb-3">
            <div className="max-w-[80%]">
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm mb-2">
                <div className="whitespace-pre-wrap">{content.text}</div>
              </div>
              <div className="flex flex-col gap-1">
                {content.buttons.map((btn) => (
                  <button
                    key={btn.id}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleButtonClick(btn.id, btn.label)}
                    disabled={isLoading}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      }

      if (content.type === 'menu') {
        return (
          <div key={msg.id} className="flex justify-start mb-3">
            <div className="max-w-[80%]">
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm mb-2">
                <div className="whitespace-pre-wrap">{content.text}</div>
              </div>
              <div className="text-[11px] text-slate-500 space-y-1">
                {content.options.map((opt, idx) => (
                  <div key={opt.id}>
                    {idx + 1}. {opt.label}
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      }

      if (content.type === 'system') {
        const level = (content.payload as any).level || 'info';
        const message = (content.payload as any).message || JSON.stringify(content.payload);

        return (
          <div key={msg.id} className="flex justify-center mb-3">
            <div className={`text-xs px-3 py-1 rounded-full ${
              level === 'error' ? 'bg-red-100 text-red-700' :
              level === 'warn' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {message}
            </div>
          </div>
        );
      }
    }

    // Inbound messages (from user)
    if (msg.direction === 'inbound' && content.type === 'text') {
      return (
        <div key={msg.id} className="flex justify-end mb-3">
          <div className="max-w-[80%] rounded-lg bg-emerald-500 text-white px-3 py-2 text-sm">
            <div className="whitespace-pre-wrap">{content.text}</div>
            <div className="text-[10px] text-emerald-100 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col bg-white rounded-lg shadow-2xl border border-slate-200 w-96 h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          <div>
            <div className="font-semibold text-sm">Probar Flujo</div>
            <div className="text-xs text-emerald-100 truncate max-w-[200px]">{flow.name || flow.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-1.5 hover:bg-emerald-600 rounded transition-colors"
            title="Reiniciar conversación"
            disabled={isLoading}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-emerald-600 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-slate-400 text-sm mt-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Inicia la conversación escribiendo un mensaje</p>
          </div>
        )}

        {messages.map(renderMessage)}

        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-slate-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Variables Panel (collapsible) */}
      {Object.keys(variables).length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50">
          <details className="px-4 py-2">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
              Variables guardadas ({Object.keys(variables).length})
            </summary>
            <div className="mt-2 space-y-1">
              {Object.entries(variables).map(([key, value]) => (
                <div key={key} className="text-xs flex gap-2">
                  <span className="font-mono text-slate-600">{key}:</span>
                  <span className="text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-slate-200 p-3 bg-white rounded-b-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
