import { useEffect } from "react";

interface KeyboardShortcutsOptions {
  onSearch?: () => void;
  onToggleSettings?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (options.enabled === false) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: Focus search
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        options.onSearch?.();
      }

      // Ctrl+, or Cmd+,: Toggle settings
      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        options.onToggleSettings?.();
      }

      // Escape: Close panels
      if (event.key === "Escape") {
        options.onEscape?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [options]);
}

export const KEYBOARD_SHORTCUTS = [
  { keys: ["Ctrl", "K"], description: "Buscar conversación" },
  { keys: ["Ctrl", ","], description: "Abrir configuración" },
  { keys: ["Escape"], description: "Cerrar paneles" },
  { keys: ["Ctrl", "Enter"], description: "Enviar mensaje (en composer)" },
];
