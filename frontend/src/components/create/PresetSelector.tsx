import { FC } from "react";
import type { Preset } from "../../lib/constants";
import { Presets } from "../../lib/constants";

const presets: { id: Preset; label: string; desc: string; features: string[] }[] = [
  {
    id: Presets.SSS_1,
    label: "SSS-1 Minimal",
    desc: "Basic mint/burn/freeze/pause — for DAOs and internal tokens",
    features: ["Mint & Burn", "Freeze & Thaw", "Pause/Unpause", "RBAC"],
  },
  {
    id: Presets.SSS_2,
    label: "SSS-2 Compliant",
    desc: "Full regulatory compliance — OFAC, seizure, transfer hooks",
    features: [
      "Everything in SSS-1",
      "Permanent Delegate",
      "Transfer Hook (blacklist)",
      "Blacklist management",
      "Token seizure",
    ],
  },
];

export const PresetSelector: FC<{
  value: Preset;
  onChange: (p: Preset) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {presets.map((p) => (
      <button
        key={p.id}
        type="button"
        onClick={() => onChange(p.id)}
        className={`rounded-xl border p-4 text-left transition-colors ${
          value === p.id
            ? "border-emerald-500 bg-emerald-500/5"
            : "border-slate-700 bg-slate-800 hover:border-slate-600"
        }`}
      >
        <p className={`text-sm font-semibold ${value === p.id ? "text-emerald-400" : "text-slate-200"}`}>
          {p.label}
        </p>
        <p className="mt-1 text-xs text-slate-400">{p.desc}</p>
        <ul className="mt-3 space-y-1">
          {p.features.map((f) => (
            <li key={f} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={value === p.id ? "text-emerald-500" : "text-slate-600"}>+</span>
              {f}
            </li>
          ))}
        </ul>
      </button>
    ))}
  </div>
);
