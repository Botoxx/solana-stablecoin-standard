import { FC } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { Network } from "../../hooks/useNetwork";

const NETWORKS: Network[] = ["devnet", "mainnet-beta", "localnet"];

const NETWORK_COLORS: Record<Network, string> = {
  devnet: "bg-amber-500",
  "mainnet-beta": "bg-emerald-500",
  localnet: "bg-sky-500",
};

export const Header: FC<{
  network: Network;
  onNetworkChange: (n: Network) => void;
}> = ({ network, onNetworkChange }) => (
  <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/80 px-6 py-2.5 backdrop-blur-md z-10 relative">
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
          <span className="text-xs font-bold text-[#022c22]">S</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-200">SSS</span>
      </div>
      <div className="hidden sm:block h-4 w-px bg-[var(--color-border)]" />
      <span className="hidden text-xs text-slate-500 sm:inline tracking-wide">Stablecoin Standard</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-raised)] px-2.5 py-1.5">
        <div className={`h-1.5 w-1.5 rounded-full ${NETWORK_COLORS[network]}`} />
        <select
          value={network}
          onChange={(e) => onNetworkChange(e.target.value as Network)}
          className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
        >
          {NETWORKS.map((n) => (
            <option key={n} value={n} className="bg-[var(--color-bg-raised)]">{n}</option>
          ))}
        </select>
      </div>
      <WalletMultiButton />
    </div>
  </header>
);
