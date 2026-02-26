import { FC } from "react";
import { useToast } from "../../context/ToastContext";
import { TransactionLink } from "./TransactionLink";
import { LoadingSpinner } from "./LoadingSpinner";

const STYLES: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  success: { border: "border-emerald-500/30", bg: "bg-emerald-500/[0.06]", text: "text-emerald-300", icon: "M5 13l4 4L19 7" },
  error: { border: "border-rose-500/30", bg: "bg-rose-500/[0.06]", text: "text-rose-300", icon: "M6 18L18 6M6 6l12 12" },
  info: { border: "border-sky-500/30", bg: "bg-sky-500/[0.06]", text: "text-sky-300", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  loading: { border: "border-[var(--color-border)]", bg: "bg-[var(--color-bg-raised)]", text: "text-slate-300", icon: "" },
};

export const ToastContainer: FC = () => {
  const { toasts, removeToast } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl animate-slide-in-right ${s.border} ${s.bg} min-w-[300px] max-w-[420px]`}
          >
            {t.type === "loading" ? (
              <LoadingSpinner className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <svg className={`h-4 w-4 mt-0.5 shrink-0 ${s.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${s.text}`}>{t.message}</p>
              {t.signature && (
                <div className="mt-1.5">
                  <TransactionLink signature={t.signature} label="View on Explorer" />
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};
