import { FC, ReactNode } from "react";

export const EmptyState: FC<{ title: string; children?: ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
    <p className="text-sm font-medium text-slate-400">{title}</p>
    {children && <div className="mt-2 text-xs text-slate-500">{children}</div>}
  </div>
);
