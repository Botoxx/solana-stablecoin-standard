import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { useToast } from "../../context/ToastContext";
import { parseAnchorError } from "../../context/StablecoinContext";
import { AddressInput } from "../shared/AddressInput";
import type { BlacklistState } from "../../lib/stablecoin";

export const BlacklistPanel: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const { addToast } = useToast();
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const [checkResult, setCheckResult] = useState<BlacklistState | null | undefined>(undefined);

  if (!state?.enablePermanentDelegate && !state?.enableTransferHook) return null;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !address || !reason) return;
    await execute("Adding to blacklist", () => stablecoin.blacklistAdd(new PublicKey(address), reason));
    setReason("");
  };

  const handleRemove = () => {
    if (!stablecoin || !address) return;
    execute("Removing from blacklist", () => stablecoin.blacklistRemove(new PublicKey(address)));
    setCheckResult(undefined);
  };

  const handleCheck = async () => {
    if (!stablecoin || !address) return;
    try {
      setCheckResult(await stablecoin.getBlacklistEntry(new PublicKey(address)));
    } catch (err) {
      addToast("error", parseAnchorError(err));
    }
  };

  return (
    <div className="space-y-4">
      <p className="section-title">Blacklist Management</p>
      <form onSubmit={handleAdd} className="space-y-4">
        <AddressInput label="Address" value={address} onChange={(v) => { setAddress(v); setCheckResult(undefined); }} />
        <div>
          <label className="label">Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={128} placeholder="OFAC sanctioned entity" className="input" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!stablecoin || !address || !reason} className="btn btn-danger">
            Blacklist
          </button>
          <button type="button" onClick={handleRemove} disabled={!stablecoin || !address} className="btn btn-ghost">
            Remove
          </button>
          <button type="button" onClick={handleCheck} disabled={!stablecoin || !address} className="btn btn-ghost">
            Check Status
          </button>
        </div>
      </form>

      {checkResult !== undefined && (
        <div className={`rounded-lg border p-3 animate-slide-up ${
          checkResult?.active
            ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.04]"
            : "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04]"
        }`}>
          {checkResult?.active ? (
            <>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[var(--color-danger)]" />
                <p className="text-sm font-medium text-[var(--color-danger)]">Blacklisted</p>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Reason: {checkResult.reason}</p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              <p className="text-sm font-medium text-[var(--color-accent)]">Not blacklisted</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
