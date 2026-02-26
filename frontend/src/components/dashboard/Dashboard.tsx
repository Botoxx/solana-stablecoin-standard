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
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const AddrRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
    <span className="text-xs text-slate-500">{label}</span>
    <span className="mono-data">{shortAddr(value)}</span>
  </div>
);

export const Dashboard: FC = () => {
  const { stablecoin, state, loading, refreshState } = useStablecoinContext();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!stablecoin || !state) {
    return (
      <EmptyState title="No stablecoin loaded">
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigate("/create")} className="btn btn-primary text-xs">
            Create new
          </button>
          <button onClick={() => navigate("/load")} className="btn btn-ghost text-xs">
            Load existing
          </button>
        </div>
      </EmptyState>
    );
  }

  const supply = state.totalMinted.sub(state.totalBurned);
  const preset = state.enablePermanentDelegate || state.enableTransferHook ? "SSS-2" : "SSS-1";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-100">Dashboard</h1>
            <span className={`pill ${preset === "SSS-2" ? "pill-success" : "pill-neutral"}`}>{preset}</span>
            {state.paused && <span className="pill pill-warning animate-pulse-subtle">PAUSED</span>}
          </div>
          <p className="mt-1 mono-data">{stablecoin.mintAddress.toBase58()}</p>
        </div>
        <button onClick={refreshState} className="btn btn-ghost text-xs" title="Refresh state">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <StatCard label="Total Supply" value={formatBN(supply, state.decimals)} accent="success" />
        <StatCard label="Total Minted" value={formatBN(state.totalMinted, state.decimals)} />
        <StatCard label="Total Burned" value={formatBN(state.totalBurned, state.decimals)} />
        <StatCard label="Decimals" value={String(state.decimals)} />
      </div>

      {/* Extensions + Addresses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="section-title mb-3">Extensions</p>
          <ExtensionBadges
            permanentDelegate={state.enablePermanentDelegate}
            transferHook={state.enableTransferHook}
            defaultAccountFrozen={state.defaultAccountFrozen}
          />
        </div>
        <div className="card">
          <p className="section-title mb-3">Addresses</p>
          <div>
            <AddrRow label="Config PDA" value={stablecoin.configPda.toBase58()} />
            <AddrRow label="Mint" value={stablecoin.mintAddress.toBase58()} />
            <AddrRow label="Authority" value={state.authority.toBase58()} />
            <AddrRow label="Treasury" value={state.treasury.toBase58()} />
          </div>
        </div>
      </div>
    </div>
  );
};
