import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { SssToken } from "../idl/sss_token";
import type { TransferHook } from "../idl/transfer_hook";
import sssTokenIdl from "../idl/sss_token.json";
import transferHookIdl from "../idl/transfer_hook.json";

export function usePrograms() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return { provider: null, program: null, hookProgram: null };

    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program<SssToken>(sssTokenIdl as never, provider);
    const hookProgram = new Program<TransferHook>(transferHookIdl as never, provider);

    return { provider, program, hookProgram };
  }, [connection, wallet]);
}
