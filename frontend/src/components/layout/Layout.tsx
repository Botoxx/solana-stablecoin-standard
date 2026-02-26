import { FC, ReactNode, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import type { Network } from "../../hooks/useNetwork";

export const Layout: FC<{
  network: Network;
  onNetworkChange: (n: Network) => void;
  children: ReactNode;
}> = ({ network, onNetworkChange, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <Header network={network} onNetworkChange={onNetworkChange} />
      <div className="flex flex-1 overflow-hidden">
        <button
          className="absolute left-3 top-3 z-40 rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
