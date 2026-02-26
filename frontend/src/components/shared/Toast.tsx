import { FC } from "react";
import { useToast } from "../../context/ToastContext";
import { TransactionLink } from "./TransactionLink";
import { LoadingSpinner } from "./LoadingSpinner";

const COLORS: Record<string, string> = {
  success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  error: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  info: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  loading: "border-slate-600 bg-slate-800 text-slate-300",
};

export const ToastContainer: FC = () => {
  const { toasts, removeToast } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${COLORS[t.type]} min-w-[280px] max-w-[400px]`}
        >
          {t.type === "loading" && <LoadingSpinner className="h-4 w-4 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">{t.message}</p>
            {t.signature && (
              <div className="mt-1">
                <TransactionLink signature={t.signature} label="View on Explorer" />
              </div>
            )}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 text-slate-500 hover:text-slate-300"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};
