import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  sender: "agent" | "client" | "system";
  name: string;
  text: string;
  timestamp: string;
  avatar?: string;
}

interface ChatPopupProps {
  agentName: string;
  agentAvatar?: string;
  isOnline: boolean;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
  messages?: Message[];
}

export default function ChatPopup({
  agentName,
  agentAvatar,
  isOnline,
  onClose,
  onSendMessage,
  messages = [],
}: ChatPopupProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "client",
      name: "You",
      text: inputValue,
      timestamp,
    };

    setLocalMessages((prev) => [...prev, newMessage]);
    onSendMessage?.(inputValue);
    setInputValue("");

    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-900 rounded-full px-5 py-3 shadow-2xl cursor-pointer hover:shadow-3xl transition-all"
        onClick={() => setIsMinimized(false)}
      >
        <div className="relative">
          {agentAvatar ? (
            <img src={agentAvatar} alt={agentName} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
              {agentName.charAt(0)}
            </div>
          )}
          {isOnline && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{agentName}</p>
          <p className="text-xs text-slate-300">Click to open chat</p>
        </div>
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] h-[700px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <h3 className="text-white font-semibold text-lg tracking-wide">Zendesk Chat</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-white hover:text-slate-300 transition p-1"
            title="Minimize"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-white hover:text-slate-300 transition p-1"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Agent Info */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="relative">
          {agentAvatar ? (
            <img src={agentAvatar} alt={agentName} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
              {agentName.charAt(0)}
            </div>
          )}
          {isOnline && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-slate-900 font-bold text-sm">{agentName}</p>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              Online
            </div>
            <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-white">
        {localMessages.map((message) => {
          if (message.sender === "system") {
            return (
              <div key={message.id} className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400 italic flex-1">{message.text}</p>
                <span className="text-xs text-slate-400">{message.timestamp}</span>
              </div>
            );
          }

          return (
            <div key={message.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={`text-sm font-bold ${
                    message.sender === "client" ? "text-yellow-600" : "text-slate-900"
                  }`}
                >
                  {message.name}
                </p>
                <span className="text-xs text-slate-400">{message.timestamp}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{message.text}</p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white">
        <div className="relative">
          {/* Help Button */}
          <button
            className="absolute -top-2 -right-2 bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white text-xs font-bold px-2 py-6 rounded-l-lg shadow-lg transition-all z-[9000] writing-mode-vertical"
            title="Get help"
            style={{ writingMode: "vertical-rl" }}
          >
            Help
          </button>

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full min-h-[100px] max-h-[120px] border-2 border-yellow-500 rounded-lg px-4 py-3 pr-16 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-yellow-600 resize-none transition-all"
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 mt-3">
          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition text-xs font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
              />
            </svg>
            Rating
          </button>
          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition text-xs font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            Attach
          </button>
        </div>
      </div>

      <style>{`
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
}
