import { FC, useCallback, useEffect, useState } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { parseAnchorError } from "../../context/StablecoinContext";
import { useToast } from "../../context/ToastContext";
import type { MinterState } from "../../lib/stablecoin";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

function shortAddr(a: string) { return `${a.slice(0, 4)}...${a.slice(-4)}`; }
function formatBN(bn: BN): string { return bn.toString(); }
function pct(remaining: BN, total: BN): number {
  if (total.isZero()) return 0;
  return remaining.mul(new BN(100)).div(total).toNumber();
}

export const MinterList: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const { addToast } = useToast();
  const [minters, setMinters] = useState<(MinterState & { publicKey: PublicKey })[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!stablecoin) return;
    setLoading(true);
    try {
      setMinters(await stablecoin.getAllMinters());
    } catch (err) {
      addToast("error", `Failed to load minters: ${parseAnchorError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [stablecoin, addToast]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!stablecoin) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-title">Minters</p>
        <button onClick={refresh} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500 animate-pulse-subtle">Loading...</p>
      ) : minters.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No minters configured</p>
      ) : (
        <div className="space-y-2">
          {minters.map((m) => {
            const remaining = pct(m.quotaRemaining, m.quotaTotal);
            return (
              <div key={m.publicKey.toBase58()} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] p-3">
                <div className="flex items-center justify-between">
                  <span className="mono-data">{shortAddr(m.minter.toBase58())}</span>
                  <span className={`text-xs font-medium ${remaining > 20 ? "text-[var(--color-accent)]" : "text-[var(--color-warning)]"}`}>{remaining}%</span>
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-[var(--color-bg-surface)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${remaining > 20 ? "bg-[var(--color-accent)]" : "bg-[var(--color-warning)]"}`}
                    style={{ width: `${remaining}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Remaining: {formatBN(m.quotaRemaining)}</span>
                  <span>Total: {formatBN(m.quotaTotal)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
