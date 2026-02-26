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

  const handleRemove = () => {
    if (!stablecoin || !address) return;
    execute("Removing minter", () => stablecoin.removeMinter(new PublicKey(address)));
  };

  const handleUpdateQuota = () => {
    if (!stablecoin || !address || !quota) return;
    execute("Updating quota", () => stablecoin.updateMinterQuota(new PublicKey(address), new BN(quota)));
  };

  return (
    <form onSubmit={handleAdd} className="space-y-4">
      <p className="section-title">Manage Minters</p>
      <AddressInput label="Minter Address" value={address} onChange={setAddress} />
      <AmountInput label="Quota (raw token units)" value={quota} onChange={setQuota} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!stablecoin || !address || !quota} className="btn btn-primary">
          Add Minter
        </button>
        <button type="button" onClick={handleUpdateQuota} disabled={!stablecoin || !address || !quota} className="btn btn-ghost">
          Update Quota
        </button>
        <button type="button" onClick={handleRemove} disabled={!stablecoin || !address} className="btn btn-outline-danger">
          Remove
        </button>
      </div>
    </form>
  );
};
