import { useState, useCallback } from "react";
import type { ToastProps } from "./Toast";

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info", duration?: number) => {
    const id = `toast-${++toastId}`;
    const newToast: ToastProps = {
      id,
      message,
      type,
      duration,
      onClose: (closeId: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== closeId));
      },
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, closeToast };
}
