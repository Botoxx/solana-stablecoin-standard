import { FC } from "react";
import { BN } from "@coral-xyz/anchor";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { StatCard } from "./StatCard";
import { ExtensionBadges } from "./ExtensionBadges";
import { EmptyState } from "../shared/EmptyState";
import { useNavigate } from "react-router-dom";

function formatBN(bn: BN, decimals: number): string {
  const raw = bn.toString();
  if (decimals === 0) return raw;
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const Dashboard: FC = () => {
  const { stablecoin, state, loading } = useStablecoinContext();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!stablecoin || !state) {
    return (
      <EmptyState title="No stablecoin loaded">
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => navigate("/create")}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Create
          </button>
          <button
            onClick={() => navigate("/load")}
            className="rounded-lg border border-slate-600 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Load existing
          </button>
        </div>
      </EmptyState>
    );
  }

  const supply = state.totalMinted.sub(state.totalBurned);
  const preset = state.enablePermanentDelegate || state.enableTransferHook ? "SSS-2" : "SSS-1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            <span className="text-emerald-400 font-medium">{preset}</span>
            {" — "}
            <span className="font-mono text-xs">{shortAddr(stablecoin.mintAddress.toBase58())}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state.paused && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-400">
              PAUSED
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Supply"
          value={formatBN(supply, state.decimals)}
          color="text-emerald-400"
        />
        <StatCard
          label="Total Minted"
          value={formatBN(state.totalMinted, state.decimals)}
        />
        <StatCard
          label="Total Burned"
          value={formatBN(state.totalBurned, state.decimals)}
        />
        <StatCard label="Decimals" value={String(state.decimals)} />
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Extensions</h2>
        <ExtensionBadges
          permanentDelegate={state.enablePermanentDelegate}
          transferHook={state.enableTransferHook}
          defaultAccountFrozen={state.defaultAccountFrozen}
        />
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Addresses</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
          <div>
            <span className="text-slate-500">Config PDA:</span>{" "}
            <span className="font-mono text-slate-300">{shortAddr(stablecoin.configPda.toBase58())}</span>
          </div>
          <div>
            <span className="text-slate-500">Mint:</span>{" "}
            <span className="font-mono text-slate-300">{shortAddr(stablecoin.mintAddress.toBase58())}</span>
          </div>
          <div>
            <span className="text-slate-500">Authority:</span>{" "}
            <span className="font-mono text-slate-300">{shortAddr(state.authority.toBase58())}</span>
          </div>
          <div>
            <span className="text-slate-500">Treasury:</span>{" "}
            <span className="font-mono text-slate-300">{shortAddr(state.treasury.toBase58())}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
