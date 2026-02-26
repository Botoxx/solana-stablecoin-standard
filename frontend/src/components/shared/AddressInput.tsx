import { FC, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";

export const AddressInput: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => {
  const [error, setError] = useState("");

  const handleChange = useCallback(
    (v: string) => {
      onChange(v);
      if (v && v.length > 0) {
        try {
          new PublicKey(v);
          setError("");
        } catch {
          setError("Invalid address");
        }
      } else {
        setError("");
      }
    },
    [onChange],
  );

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? "Base58 address..."}
        className={`w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 ${
          error ? "border-rose-500" : "border-slate-700 focus:border-emerald-500"
        }`}
      />
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
};
