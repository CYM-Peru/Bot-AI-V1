import { useEffect, useState } from "react";
import { authFetch } from "../lib/apiBase";

interface ConversationTagsProps {
  conversationId: string;
  initialTags?: string[];
  onTagsUpdate?: (tags: string[]) => void;
}

const SUGGESTED_TAGS = [
  "Urgente",
  "VIP",
  "Soporte",
  "Ventas",
  "Reclamo",
  "Consulta",
  "Seguimiento",
  "Problema Técnico",
  "Pedido",
  "Devolución",
];

export default function ConversationTags({ conversationId, initialTags = [], onTagsUpdate }: ConversationTagsProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing tags when component mounts
  useEffect(() => {
    let ignore = false;

    const loadTags = async () => {
      try {
        const response = await authFetch(`/api/crm/metrics/${conversationId}/tags`, {
          method: "GET",
        });

        if (response.ok && !ignore) {
          const data = await response.json();
          setTags(data.tags || []);
        }
      } catch (error) {
        console.error("[Tags] Error loading tags:", error);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadTags();

    return () => {
      ignore = true;
    };
  }, [conversationId]);

  const filteredSuggestions = SUGGESTED_TAGS.filter(
    (tag) => !tags.includes(tag) && tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addTag = async (tag: string) => {
    if (!tag.trim() || tags.includes(tag)) return;

    const newTags = [...tags, tag.trim()];
    setTags(newTags);
    setInputValue("");
    setShowSuggestions(false);

    // Save to backend
    setSaving(true);
    try {
      const response = await authFetch(`/api/crm/metrics/${conversationId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [tag.trim()] }),
      });

      if (response.ok) {
        onTagsUpdate?.(newTags);
      } else {
        console.error("[Tags] Error saving tag");
        setTags(tags); // Revert on error
      }
    } catch (error) {
      console.error("[Tags] Error:", error);
      setTags(tags); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);

    // Save to backend
    setSaving(true);
    try {
      const response = await authFetch(`/api/crm/metrics/${conversationId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [tagToRemove] }),
      });

      if (response.ok) {
        onTagsUpdate?.(newTags);
      } else {
        console.error("[Tags] Error removing tag");
        setTags(tags); // Revert on error
      }
    } catch (error) {
      console.error("[Tags] Error:", error);
      setTags(tags); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-slate-500 py-1">
        <svg className="inline w-3 h-3 animate-spin mr-1" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Cargando etiquetas...
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Existing tags */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full border border-blue-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none"
              title="Quitar etiqueta"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {/* Input for new tags */}
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(inputValue.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="+ Agregar etiqueta"
            disabled={saving}
            className="px-3 py-1 text-xs border border-slate-300 rounded-full focus:border-blue-400 focus:ring focus:ring-blue-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minWidth: "140px" }}
          />

          {/* Suggestions dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-[9999] mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {saving && (
          <span className="text-xs text-slate-500">
            <svg className="inline w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
