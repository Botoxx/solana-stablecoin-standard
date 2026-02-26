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
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "devnet" || stored === "mainnet-beta" || stored === "localnet") return stored;
  return "devnet";
}

export function useNetwork() {
  const [network, setNetworkState] = useState<Network>(loadNetwork);

  const setNetwork = useCallback((n: Network) => {
    localStorage.setItem(STORAGE_KEY, n);
    setNetworkState(n);
  }, []);

  const endpoint = useMemo(() => ENDPOINTS[network], [network]);

  return { network, setNetwork, endpoint };
}
