import { FC, ReactNode } from "react";

export const EmptyState: FC<{ title: string; children?: ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-20 text-center animate-fade-in">
    <div className="mb-4 rounded-full bg-[var(--color-bg-surface)] p-3">
      <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
    <p className="text-sm font-medium text-slate-400">{title}</p>
    {children && <div className="mt-2 text-xs text-slate-500">{children}</div>}
  </div>
);
