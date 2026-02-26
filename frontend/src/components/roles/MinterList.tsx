import { FC, useCallback, useEffect, useState } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";
import type { MinterState } from "../../lib/stablecoin";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

function shortAddr(a: string) { return `${a.slice(0, 4)}...${a.slice(-4)}`; }

function formatBN(bn: BN): string { return bn.toString(); }

function pct(remaining: BN, total: BN): number {
  if (total.isZero()) return 0;
  return Math.round(remaining.toNumber() / total.toNumber() * 100);
}

export const MinterList: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const [minters, setMinters] = useState<(MinterState & { publicKey: PublicKey })[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!stablecoin) return;
    setLoading(true);
    try {
      setMinters(await stablecoin.getAllMinters());
    } catch { /* ignore */ }
    setLoading(false);
  }, [stablecoin]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!stablecoin) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Minters</h3>
        <button onClick={refresh} className="text-xs text-slate-500 hover:text-slate-300">Refresh</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : minters.length === 0 ? (
        <p className="text-xs text-slate-500">No minters configured</p>
      ) : (
        <div className="space-y-2">
          {minters.map((m) => {
            const used = pct(m.quotaRemaining, m.quotaTotal);
            return (
              <div key={m.publicKey.toBase58()} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300">{shortAddr(m.minter.toBase58())}</span>
                  <span className="text-slate-500">{used}% remaining</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${used}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-500">
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
