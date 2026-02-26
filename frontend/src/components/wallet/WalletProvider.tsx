import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import type { Adapter } from "@solana/wallet-adapter-base";

const isE2E = import.meta.env.VITE_E2E === "true";

export const WalletProvider: FC<{ endpoint: string; children: ReactNode }> = ({
  endpoint,
  children,
}) => {
  const [e2eWallets, setE2eWallets] = useState<Adapter[]>([]);
  const [e2eReady, setE2eReady] = useState(!isE2E);

  useEffect(() => {
    if (!isE2E) return;
    import("./TestWalletAdapter").then(({ TestWalletAdapter }) => {
      setE2eWallets([new TestWalletAdapter()]);
      setE2eReady(true);
    });
  }, []);

  const prodWallets = useMemo(
    () => (isE2E ? [] : [new PhantomWalletAdapter(), new SolflareWalletAdapter()]),
    [],
  );

  const wallets = isE2E ? e2eWallets : prodWallets;

  if (!e2eReady) {
    // Render full provider tree with empty wallets while E2E adapter loads
    return (
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={[]} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
