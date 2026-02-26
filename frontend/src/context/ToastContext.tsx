import { createContext, FC, ReactNode, useCallback, useContext, useState } from "react";
import type { Network } from "../hooks/useNetwork";

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  signature?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  network: Network;
  addToast: (type: ToastType, message: string, signature?: string) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, "id">>) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);

let nextId = 0;

export const ToastProvider: FC<{ network: Network; children: ReactNode }> = ({
  network,
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, signature?: string) => {
    const id = String(++nextId);
    setToasts((prev) => [...prev, { id, type, message, signature }]);
    if (type !== "loading") {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
    }
    return id;
  }, []);

  const removeToast = useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const updateToast = useCallback(
    (id: string, updates: Partial<Omit<Toast, "id">>) =>
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const updated = { ...t, ...updates };
          if (updates.type && updates.type !== "loading") {
            setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 6000);
          }
          return updated;
        }),
      ),
    [],
  );

  return <Ctx.Provider value={{ toasts, network, addToast, removeToast, updateToast }}>{children}</Ctx.Provider>;
};

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
