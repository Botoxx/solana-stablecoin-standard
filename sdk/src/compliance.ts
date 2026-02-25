import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, TransactionSignature } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { SssToken } from "./idl/sss_token";
import { getBlacklistPda, getRolePda } from "./pda";
import { RoleType, BlacklistState } from "./types";

export class ComplianceModule {
  constructor(
    private program: Program<SssToken>,
    private configPda: PublicKey,
    private mint: PublicKey,
    private getAuthority: () => Keypair
  ) {}

  async blacklistAdd(
    address: PublicKey,
    reason: string,
    blacklister?: Keypair
  ): Promise<TransactionSignature> {
    const signer = blacklister ?? this.getAuthority();
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    return this.program.methods
      .addToBlacklist(address, reason)
      .accounts({
        blacklister: signer.publicKey,
        blacklistEntry: blacklistPda,
      } as any)
      .signers([signer])
      .rpc();
  }

  async blacklistRemove(
    address: PublicKey,
    blacklister?: Keypair
  ): Promise<TransactionSignature> {
    const signer = blacklister ?? this.getAuthority();
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    return this.program.methods
      .removeFromBlacklist(address)
      .accounts({
        blacklister: signer.publicKey,
        blacklistEntry: blacklistPda,
      } as any)
      .signers([signer])
      .rpc();
  }

  async seize(
    frozenAccount: PublicKey,
    treasury: PublicKey,
    amount: BN,
    seizer?: Keypair
  ): Promise<TransactionSignature> {
    const signer = seizer ?? this.getAuthority();
    return this.program.methods
      .seize(amount)
      .accounts({
        seizer: signer.publicKey,
        mint: this.mint,
        sourceTokenAccount: frozenAccount,
        treasuryTokenAccount: treasury,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([signer])
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
