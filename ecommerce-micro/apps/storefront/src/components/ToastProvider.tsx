import { CheckCircle, XCircle, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (message: string, options?: { variant?: ToastVariant; action?: Toast["action"] }) => void;
  success: (message: string, action?: Toast["action"]) => void;
  error: (message: string, action?: Toast["action"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
};

const VARIANT_BG: Record<ToastVariant, string> = {
  success: "bg-emerald-600",
  error: "bg-rose-600",
  info: "bg-slate-800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, options?: { variant?: ToastVariant; action?: Toast["action"] }) => {
    const id = Date.now() + Math.random();
    const variant = options?.variant ?? "info";
    setToasts((prev) => [...prev, { id, message, variant, action: options?.action }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const success = useCallback((message: string, action?: Toast["action"]) => toast(message, { variant: "success", action }), [toast]);
  const error = useCallback((message: string, action?: Toast["action"]) => toast(message, { variant: "error", action }), [toast]);

  // Expose via window so non-React code (e.g. raw fetch wrappers) can toast.
  useEffect(() => {
    (window as unknown as { toast?: ToastContextValue }).toast = { toast, success, error };
  }, [toast, success, error]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-6 z-50 flex flex-col gap-2 max-w-xs">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg shadow-black/10 animate-[toast-in_0.28s_ease-out] ${VARIANT_BG[t.variant]}`}
            role="status"
          >
            <span className="mt-0.5 shrink-0">{VARIANT_ICON[t.variant]}</span>
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="shrink-0 rounded bg-white/20 px-2 py-0.5 text-xs font-medium hover:bg-white/30 ring-focus"
                onClick={() => { t.action?.onClick(); dismiss(t.id); }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="shrink-0 text-white/70 hover:text-white ring-focus"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
