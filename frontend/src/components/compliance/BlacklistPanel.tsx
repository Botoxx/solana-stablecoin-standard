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
    await execute("Adding to blacklist", () =>
      stablecoin.blacklistAdd(new PublicKey(address), reason),
    );
    setReason("");
  };

  const handleRemove = async () => {
    if (!stablecoin || !address) return;
    await execute("Removing from blacklist", () =>
      stablecoin.blacklistRemove(new PublicKey(address)),
    );
    setCheckResult(undefined);
  };

  const handleCheck = async () => {
    if (!stablecoin || !address) return;
    try {
      const entry = await stablecoin.getBlacklistEntry(new PublicKey(address));
      setCheckResult(entry);
    } catch (err) {
      addToast("error", parseAnchorError(err));
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Blacklist Management</h3>
      <form onSubmit={handleAdd} className="space-y-4">
        <AddressInput label="Address" value={address} onChange={(v) => { setAddress(v); setCheckResult(undefined); }} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Reason</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={128}
            placeholder="OFAC sanctioned entity"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!stablecoin || !address || !reason}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Blacklist
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={!stablecoin || !address}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={handleCheck}
            disabled={!stablecoin || !address}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Check
          </button>
        </div>
      </form>

      {checkResult !== undefined && (
        <div className={`rounded-lg border p-3 text-xs ${
          checkResult && checkResult.active
            ? "border-rose-500/30 bg-rose-500/5 text-rose-300"
            : "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
        }`}>
          {checkResult && checkResult.active ? (
            <>
              <p className="font-medium">Blacklisted</p>
              <p className="mt-1 text-slate-400">Reason: {checkResult.reason}</p>
            </>
          ) : (
            <p className="font-medium">Not blacklisted</p>
          )}
        </div>
      )}
    </div>
  );
};
