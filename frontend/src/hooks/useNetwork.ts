import { useState, useCallback, useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";

export type Network = "devnet" | "mainnet-beta" | "localnet";

const ENDPOINTS: Record<Network, string> = {
  devnet: clusterApiUrl("devnet"),
  "mainnet-beta": clusterApiUrl("mainnet-beta"),
  localnet: "http://127.0.0.1:8899",
};

const STORAGE_KEY = "sss-network";

function loadNetwork(): Network {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "devnet" || stored === "mainnet-beta" || stored === "localnet") return stored;
  } catch {
    // localStorage unavailable (private browsing, storage quota)
  }
  return "devnet";
}

export function useNetwork() {
  const [network, setNetworkState] = useState<Network>(loadNetwork);

  const setNetwork = useCallback((n: Network) => {
    try { localStorage.setItem(STORAGE_KEY, n); } catch { /* ignore storage errors */ }
    setNetworkState(n);
  }, []);

  const endpoint = useMemo(() => ENDPOINTS[network], [network]);

  return { network, setNetwork, endpoint };
}
