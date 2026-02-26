import { FC } from "react";

export const AmountInput: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  max?: string;
}> = ({ label, value, onChange, max }) => (
  <div>
    <label className="label">{label}</label>
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="0.00"
        className="input font-mono tabular-nums"
      />
      {max && (
        <button
          type="button"
          onClick={() => onChange(max)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-[var(--color-bg-surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
        >
          Max
        </button>
      )}
    </div>
  </div>
);
