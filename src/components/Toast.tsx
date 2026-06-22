"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "info" | "warning" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div 
        id="toast-container"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  // Trigger exit animation before removing from DOM
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200); // match fade-out animation length
  };

  // Styles based on type - Theme aware using CSS variables and tailwind utility classes
  const styles = {
    success: "border-emerald-500/20 bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 shadow-emerald-500/5",
    info: "border-sky-500/20 bg-sky-50/90 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 shadow-sky-500/5",
    warning: "border-amber-500/20 bg-amber-50/90 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 shadow-amber-500/5",
    error: "border-rose-500/20 bg-rose-50/90 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 shadow-rose-500/5"
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-teal-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
  };

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-300 ${
        isExiting ? "opacity-0 translate-y-2 scale-95" : "animate-slide-up"
      } ${styles[toast.type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        {icons[toast.type]}
        <p className="text-xs font-bold leading-normal">{toast.message}</p>
      </div>
      <button
        onClick={handleClose}
        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-current/60 hover:text-current transition-colors cursor-pointer outline-none"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
