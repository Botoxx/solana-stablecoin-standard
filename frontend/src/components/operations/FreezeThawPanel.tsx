import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";

export const FreezeThawPanel: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [address, setAddress] = useState("");

  const handleFreeze = () => {
    if (!stablecoin || !address) return;
    execute("Freezing account", () => stablecoin.freezeAccount(new PublicKey(address)));
  };

  const handleThaw = () => {
    if (!stablecoin || !address) return;
    execute("Thawing account", () => stablecoin.thawAccount(new PublicKey(address)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-info)]" />
        <h3 className="text-sm font-semibold text-slate-200">Freeze / Thaw</h3>
      </div>
      <AddressInput label="Token Account" value={address} onChange={setAddress} />
      <div className="flex gap-2">
        <button onClick={handleFreeze} disabled={!stablecoin || !address} className="btn btn-ghost flex-1">
          Freeze
        </button>
        <button onClick={handleThaw} disabled={!stablecoin || !address} className="btn btn-ghost flex-1">
          Thaw
        </button>
      </div>
    </div>
  );
};
