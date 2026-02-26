import { FC } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { Network } from "../../hooks/useNetwork";

const NETWORKS: Network[] = ["devnet", "mainnet-beta", "localnet"];

export const Header: FC<{
  network: Network;
  onNetworkChange: (n: Network) => void;
}> = ({ network, onNetworkChange }) => (
  <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 py-3 backdrop-blur">
    <div className="flex items-center gap-3">
      <span className="text-lg font-semibold tracking-tight text-emerald-400">SSS</span>
      <span className="hidden text-sm text-slate-500 sm:inline">Stablecoin Standard</span>
    </div>
    <div className="flex items-center gap-3">
      <select
        value={network}
        onChange={(e) => onNetworkChange(e.target.value as Network)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-500"
      >
        {NETWORKS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <WalletMultiButton />
    </div>
  </header>
);
