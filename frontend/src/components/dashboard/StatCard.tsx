import { FC, ReactNode } from "react";

export const StatCard: FC<{
  label: string;
  value: string | ReactNode;
  sub?: string;
  accent?: "default" | "success" | "danger" | "warning";
}> = ({ label, value, sub, accent = "default" }) => {
  const accentClass = {
    default: "",
    success: "card-accent",
    danger: "card-danger",
    warning: "card-warning",
  }[accent];

  return (
    <div className={`card ${accentClass}`}>
      <p className="label">{label}</p>
      <p className="mono-value mt-2 text-slate-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
};
