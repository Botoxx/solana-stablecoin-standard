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
      if (v.length > 0) {
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
      <label className="label">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? "Base58 address..."}
        className={`input font-mono text-xs ${error ? "input-error" : ""}`}
      />
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
};
