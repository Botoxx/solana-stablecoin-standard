import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionSignature, Keypair } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { SssToken } from "./idl/sss_token";
import { getBlacklistPda, getRolePda } from "./pda";
import { RoleType, BlacklistState } from "./types";

export class ComplianceModule {
  constructor(
    private program: Program<SssToken>,
    private configPda: PublicKey,
    private mint: PublicKey
  ) {}

  async addToBlacklist(
    blacklister: Keypair,
    address: PublicKey,
    reason: string
  ): Promise<TransactionSignature> {
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    return this.program.methods
      .addToBlacklist(address, reason)
      .accounts({
        blacklister: blacklister.publicKey,
        blacklistEntry: blacklistPda,
      } as any)
      .signers([blacklister])
      .rpc();
  }

  async removeFromBlacklist(
    blacklister: Keypair,
    address: PublicKey
  ): Promise<TransactionSignature> {
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    return this.program.methods
      .removeFromBlacklist(address)
      .accounts({
        blacklister: blacklister.publicKey,
        blacklistEntry: blacklistPda,
      } as any)
      .signers([blacklister])
      .rpc();
  }

  async seize(
    seizer: Keypair,
    sourceTokenAccount: PublicKey,
    treasuryTokenAccount: PublicKey,
    amount: BN
  ): Promise<TransactionSignature> {
    return this.program.methods
      .seize(amount)
      .accounts({
        seizer: seizer.publicKey,
        mint: this.mint,
        sourceTokenAccount,
        treasuryTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([seizer])
      .rpc();
  }

  async getBlacklistEntry(address: PublicKey): Promise<BlacklistState | null> {
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    try {
      return (await this.program.account.blacklistEntry.fetch(
        blacklistPda
      )) as unknown as BlacklistState;
    } catch {
      return null;
    }
  }

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    const entry = await this.getBlacklistEntry(address);
    return entry !== null && entry.active;
  }
}
