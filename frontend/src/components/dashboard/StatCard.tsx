import { FC, ReactNode } from "react";

export const StatCard: FC<{
  label: string;
  value: string | ReactNode;
  sub?: string;
  color?: string;
}> = ({ label, value, sub, color = "text-slate-100" }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
    <p className="text-xs font-medium text-slate-400">{label}</p>
    <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
  </div>
);
