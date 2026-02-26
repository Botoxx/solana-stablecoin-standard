import { createContext, FC, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BrowserStablecoin, StablecoinState } from "../lib/stablecoin";
import { usePrograms } from "../lib/program";
import { useToast } from "./ToastContext";
import { ERROR_MESSAGES } from "../lib/constants";
import type { Preset, StablecoinExtensions } from "../lib/constants";
import { PublicKey } from "@solana/web3.js";

const STORAGE_KEY = "sss:configPda";

interface StablecoinContextValue {
  stablecoin: BrowserStablecoin | null;
  state: StablecoinState | null;
  loading: boolean;
  createStablecoin: (params: {
    name: string;
    symbol: string;
    uri?: string;
    decimals?: number;
    preset?: Preset;
    extensions?: Partial<StablecoinExtensions>;
    treasury?: PublicKey;
  }) => Promise<void>;
  loadStablecoin: (configPda: PublicKey) => Promise<void>;
  refreshState: () => Promise<void>;
  clearStablecoin: () => void;
}

const Ctx = createContext<StablecoinContextValue | null>(null);

export function parseAnchorError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  const match = msg.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (match) {
    const code = parseInt(match[1], 16);
    if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }
  if (msg.includes("User rejected")) return "Transaction rejected by wallet";
  if (msg.includes("Blockhash not found")) return "Transaction expired — try again";
  if (msg.includes("insufficient funds")) return "Insufficient SOL for transaction fees";
  return msg.length > 120 ? msg.slice(0, 120) + "..." : msg;
}

export const StablecoinProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { program, hookProgram } = usePrograms();
  const { addToast, updateToast } = useToast();
  const [stablecoin, setStablecoin] = useState<BrowserStablecoin | null>(null);
  const [state, setState] = useState<StablecoinState | null>(null);
  const [loading, setLoading] = useState(false);
  const restoredRef = useRef(false);

  // Auto-restore from localStorage when programs become available
  useEffect(() => {
    if (!program || !hookProgram || restoredRef.current) return;
    restoredRef.current = true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const configPda = new PublicKey(saved);
      setLoading(true);
      BrowserStablecoin.load(program, hookProgram, configPda)
        .then(async (sc) => {
          setStablecoin(sc);
          setState(await sc.getState());
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY);
        })
        .finally(() => setLoading(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [program, hookProgram]);

  const refreshState = useCallback(async () => {
    if (!stablecoin) return;
    try {
      setState(await stablecoin.getState());
    } catch (err) {
      addToast("error", parseAnchorError(err));
    }
  }, [stablecoin, addToast]);

  const createStablecoin = useCallback(
    async (params: Parameters<StablecoinContextValue["createStablecoin"]>[0]) => {
      if (!program || !hookProgram) {
        addToast("error", "Connect your wallet first");
        return;
      }
      setLoading(true);
      const tid = addToast("loading", "Creating stablecoin...");
      try {
        const { stablecoin: sc, signature } = await BrowserStablecoin.create(program, hookProgram, params);
        setStablecoin(sc);
        setState(await sc.getState());
        localStorage.setItem(STORAGE_KEY, sc.configPda.toBase58());
        updateToast(tid, { type: "success", message: "Stablecoin created", signature });
      } catch (err) {
        updateToast(tid, { type: "error", message: parseAnchorError(err) });
      } finally {
        setLoading(false);
      }
    },
    [program, hookProgram, addToast, updateToast],
  );

  const loadStablecoin = useCallback(
    async (configPda: PublicKey) => {
      if (!program || !hookProgram) {
        addToast("error", "Connect your wallet first");
        return;
      }
      setLoading(true);
      try {
        const sc = await BrowserStablecoin.load(program, hookProgram, configPda);
        setStablecoin(sc);
        setState(await sc.getState());
        localStorage.setItem(STORAGE_KEY, configPda.toBase58());
        addToast("success", "Stablecoin loaded");
      } catch (err) {
        addToast("error", parseAnchorError(err));
      } finally {
        setLoading(false);
      }
    },
    [program, hookProgram, addToast],
  );

  const clearStablecoin = useCallback(() => {
    setStablecoin(null);
    setState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <Ctx.Provider
      value={{ stablecoin, state, loading, createStablecoin, loadStablecoin, refreshState, clearStablecoin }}
    >
      {children}
    </Ctx.Provider>
  );
};

export function useStablecoinContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStablecoinContext must be used within StablecoinProvider");
  return ctx;
}
