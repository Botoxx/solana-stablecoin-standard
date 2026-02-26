import { FC } from "react";

export const AmountInput: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  max?: string;
}> = ({ label, value, onChange, max }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, "");
          onChange(v);
        }}
        placeholder="0.00"
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
      />
      {max && (
        <button
          type="button"
          onClick={() => onChange(max)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-600"
        >
          MAX
        </button>
      )}
    </div>
  </div>
);
