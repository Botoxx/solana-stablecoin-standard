import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";
import { AmountInput } from "../shared/AmountInput";

export const MinterManager: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [address, setAddress] = useState("");
  const [quota, setQuota] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !address || !quota) return;
    await execute("Adding minter", () =>
      stablecoin.addMinter(new PublicKey(address), new BN(quota)),
    );
  };

  const handleRemove = async () => {
    if (!stablecoin || !address) return;
    await execute("Removing minter", () =>
      stablecoin.removeMinter(new PublicKey(address)),
    );
  };

  const handleUpdateQuota = async () => {
    if (!stablecoin || !address || !quota) return;
    await execute("Updating quota", () =>
      stablecoin.updateMinterQuota(new PublicKey(address), new BN(quota)),
    );
  };

  return (
    <form onSubmit={handleAdd} className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Manage Minters</h3>
      <AddressInput label="Minter Address" value={address} onChange={setAddress} />
      <AmountInput label="Quota (raw token units)" value={quota} onChange={setQuota} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!stablecoin || !address || !quota}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Add Minter
        </button>
        <button
          type="button"
          onClick={handleUpdateQuota}
          disabled={!stablecoin || !address || !quota}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Update Quota
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={!stablecoin || !address}
          className="rounded-lg border border-rose-600/50 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </form>
  );
};
