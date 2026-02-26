import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";

export const FreezeThawPanel: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [address, setAddress] = useState("");

  const handleFreeze = async () => {
    if (!stablecoin || !address) return;
    await execute("Freezing account", () => stablecoin.freezeAccount(new PublicKey(address)));
  };

  const handleThaw = async () => {
    if (!stablecoin || !address) return;
    await execute("Thawing account", () => stablecoin.thawAccount(new PublicKey(address)));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Freeze / Thaw</h3>
      <AddressInput label="Token Account" value={address} onChange={setAddress} />
      <div className="flex gap-2">
        <button
          onClick={handleFreeze}
          disabled={!stablecoin || !address}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Freeze
        </button>
        <button
          onClick={handleThaw}
          disabled={!stablecoin || !address}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Thaw
        </button>
      </div>
    </div>
  );
};
