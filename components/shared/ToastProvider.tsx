"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastVariant = "default" | "danger" | "warn";

interface ToastEntry {
  id: number;
  text: string;
  sub?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (text: string, sub?: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const RAIL_COLOR: Record<ToastVariant, string> = {
  default: "var(--color-accent)",
  danger: "var(--color-danger)",
  warn: "var(--color-warn)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((text: string, sub?: string, variant: ToastVariant = "default") => {
    const id = ++idRef.current;
    setToasts((current) => [...current, { id, text, sub, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed right-4.5 bottom-4.5 z-100 flex flex-col items-end gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2.25 rounded-btn border border-border-strong bg-bg-raised py-2.25 pr-3.25 pl-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            style={{ borderLeft: `2px solid ${RAIL_COLOR[entry.variant]}` }}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: RAIL_COLOR[entry.variant] }}
            />
            <span className="text-ui text-text-primary">{entry.text}</span>
            {entry.sub && <span className="text-[11.5px] text-text-dim">{entry.sub}</span>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
