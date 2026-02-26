import { FC } from "react";
import type { Preset } from "../../lib/constants";
import { Presets } from "../../lib/constants";

const presets: { id: Preset; label: string; tag: string; desc: string; features: string[] }[] = [
  {
    id: Presets.SSS_1,
    label: "SSS-1",
    tag: "Minimal",
    desc: "Basic mint/burn/freeze/pause for DAOs and internal tokens",
    features: ["Mint & Burn", "Freeze & Thaw", "Pause/Unpause", "RBAC (5 roles)"],
  },
  {
    id: Presets.SSS_2,
    label: "SSS-2",
    tag: "Compliant",
    desc: "Full regulatory compliance — OFAC screening, seizure, transfer hooks",
    features: [
      "Everything in SSS-1",
      "Permanent Delegate",
      "Transfer Hook (blacklist enforcement)",
      "Blacklist management",
      "Token seizure (freeze-before-seize)",
    ],
  },
];

export const PresetSelector: FC<{
  value: Preset;
  onChange: (p: Preset) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {presets.map((p) => {
      const active = value === p.id;
      return (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`card text-left transition-all duration-150 ${
            active
              ? "border-[var(--color-accent)] bg-[var(--color-accent)]/[0.03]"
              : "hover:border-[var(--color-border-active)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${active ? "text-[var(--color-accent)]" : "text-slate-200"}`}>
              {p.label}
            </span>
            <span className={`pill ${active ? "pill-success" : "pill-neutral"} text-[10px]`}>{p.tag}</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{p.desc}</p>
          <ul className="mt-3 space-y-1.5">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs text-slate-500">
                <svg className={`mt-0.5 h-3 w-3 shrink-0 ${active ? "text-[var(--color-accent)]" : "text-slate-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </button>
      );
    })}
  </div>
);
