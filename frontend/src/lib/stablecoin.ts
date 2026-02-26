import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  TransactionSignature,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { SssToken } from "../idl/sss_token";
import type { TransferHook } from "../idl/transfer_hook";
import {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
  resolveExtensions,
  RoleType,
  ROLE_TYPE_NAMES,
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
} from "./constants";
import type { Preset, StablecoinExtensions, RoleTypeValue } from "./constants";

export interface StablecoinState {
  authority: PublicKey;
  pendingAuthority: PublicKey | null;
  mint: PublicKey;
  treasury: PublicKey;
  decimals: number;
  paused: boolean;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  transferHookProgram: PublicKey | null;
  totalMinted: BN;
  totalBurned: BN;
  bump: number;
}

export interface MinterState {
  config: PublicKey;
  minter: PublicKey;
  quotaTotal: BN;
  quotaRemaining: BN;
  bump: number;
}

export interface RoleState {
  config: PublicKey;
  roleType: RoleTypeValue;
  address: PublicKey;
  assignedBy: PublicKey;
  assignedAt: BN;
  bump: number;
}

export interface BlacklistState {
  config: PublicKey;
  address: PublicKey;
  reason: string;
  blacklistedAt: BN;
  blacklistedBy: PublicKey;
  active: boolean;
  bump: number;
}

function isNotFound(err: unknown): boolean {
  const msg = (err as Error)?.message ?? String(err);
  return msg.includes("Account does not exist") || msg.includes("Could not find");
}

export class BrowserStablecoin {
  constructor(
    public readonly program: Program<SssToken>,
    public readonly hookProgram: Program<TransferHook>,
    public readonly configPda: PublicKey,
    public readonly mintAddress: PublicKey,
    public readonly hasTransferHook: boolean,
  ) {}

  // --- Factory ---

  static async create(
    program: Program<SssToken>,
    hookProgram: Program<TransferHook>,
    params: {
      name: string;
      symbol: string;
      uri?: string;
      decimals?: number;
      preset?: Preset;
      extensions?: Partial<StablecoinExtensions>;
      treasury?: PublicKey;
    },
  ): Promise<{ stablecoin: BrowserStablecoin; signature: TransactionSignature }> {
    const authority = program.provider.publicKey!;
    const ext = resolveExtensions(params.preset, params.extensions);
    const mint = Keypair.generate();
    const [configPda] = getConfigPda(mint.publicKey);
    const treasury = params.treasury ?? authority;
    const transferHookProgramId = ext.transferHook ? TRANSFER_HOOK_PROGRAM_ID : null;

    const sig = await program.methods
      .initialize({
        name: params.name,
        symbol: params.symbol,
        uri: params.uri ?? "",
        decimals: params.decimals ?? 6,
        enablePermanentDelegate: ext.permanentDelegate,
        enableTransferHook: ext.transferHook,
        defaultAccountFrozen: ext.defaultAccountFrozen,
        transferHookProgramId,
        treasury,
      })
      .accounts({
        authority,
        mint: mint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as never)
      .signers([mint])
      .rpc();

    if (ext.transferHook) {
      const [extraAccountMetasPda] = getExtraAccountMetasPda(mint.publicKey);
      await hookProgram.methods
        .initializeExtraAccountMetaList(SSS_TOKEN_PROGRAM_ID)
        .accounts({
          payer: authority,
          extraAccountMetaList: extraAccountMetasPda,
          mint: mint.publicKey,
          config: configPda,
        } as never)
        .rpc();
    }

    return {
      stablecoin: new BrowserStablecoin(program, hookProgram, configPda, mint.publicKey, ext.transferHook),
      signature: sig,
    };
  }

  static async load(
    program: Program<SssToken>,
    hookProgram: Program<TransferHook>,
    configPda: PublicKey,
  ): Promise<BrowserStablecoin> {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    return new BrowserStablecoin(
      program,
      hookProgram,
      configPda,
      config.mint,
      config.enableTransferHook,
    );
  }

  // --- Queries ---

  async getState(): Promise<StablecoinState> {
    return (await this.program.account.stablecoinConfig.fetch(this.configPda)) as unknown as StablecoinState;
  }

  async getMinter(address: PublicKey): Promise<MinterState | null> {
    const [pda] = getMinterPda(this.configPda, address);
    try {
      return (await this.program.account.minterConfig.fetch(pda)) as unknown as MinterState;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async getAllMinters(): Promise<(MinterState & { publicKey: PublicKey })[]> {
    const accounts = await this.program.account.minterConfig.all([
      { memcmp: { offset: 8, bytes: this.configPda.toBase58() } },
    ]);
    return accounts.map((a) => ({ ...(a.account as unknown as MinterState), publicKey: a.publicKey }));
  }

  async getAllRoles(): Promise<(RoleState & { publicKey: PublicKey })[]> {
    const accounts = await this.program.account.roleAssignment.all([
      { memcmp: { offset: 8, bytes: this.configPda.toBase58() } },
    ]);
    return accounts.map((a) => ({ ...(a.account as unknown as RoleState), publicKey: a.publicKey }));
  }

  async getBlacklistEntry(address: PublicKey): Promise<BlacklistState | null> {
    const [pda] = getBlacklistPda(this.configPda, address);
    try {
      return (await this.program.account.blacklistEntry.fetch(pda)) as unknown as BlacklistState;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  getAssociatedTokenAddress(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.mintAddress,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
  }

  // --- Operations ---

  async mint(recipient: PublicKey, amount: BN): Promise<TransactionSignature> {
    const minter = this.program.provider.publicKey!;
    const [minterPda] = getMinterPda(this.configPda, minter);
    return this.program.methods
      .mint(amount)
      .accounts({
        minter,
        config: this.configPda,
        minterConfig: minterPda,
        mint: this.mintAddress,
        recipientTokenAccount: recipient,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as never)
      .rpc();
  }

  async burn(amount: BN, tokenAccount?: PublicKey): Promise<TransactionSignature> {
    const burner = this.program.provider.publicKey!;
    const account = tokenAccount ?? this.getAssociatedTokenAddress(burner);
    return this.program.methods
      .burn(amount)
      .accounts({
        burner,
        config: this.configPda,
        mint: this.mintAddress,
        burnerTokenAccount: account,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as never)
      .rpc();
  }

  async freezeAccount(tokenAccount: PublicKey): Promise<TransactionSignature> {
    return this.program.methods
      .freezeAccount()
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as never)
      .rpc();
  }

  async thawAccount(tokenAccount: PublicKey): Promise<TransactionSignature> {
    return this.program.methods
      .thawAccount()
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as never)
      .rpc();
  }

  async pause(): Promise<TransactionSignature> {
    return this.program.methods
      .pause()
      .accounts({ pauser: this.program.provider.publicKey!, config: this.configPda } as never)
      .rpc();
  }

  async unpause(): Promise<TransactionSignature> {
    return this.program.methods
      .unpause()
      .accounts({ pauser: this.program.provider.publicKey!, config: this.configPda } as never)
      .rpc();
  }

  // --- Role management ---

  async addRole(address: PublicKey, role: RoleTypeValue): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    return this.program.methods
      .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as never, { assign: {} })
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        roleAssignment: rolePda,
      } as never)
      .rpc();
  }

  async removeRole(address: PublicKey, role: RoleTypeValue): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    return this.program.methods
      .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as never, { revoke: {} })
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        roleAssignment: rolePda,
      } as never)
      .rpc();
  }

  async addMinter(address: PublicKey, quota: BN): Promise<TransactionSignature> {
    await this.addRole(address, RoleType.Minter);
    const [minterPda] = getMinterPda(this.configPda, address);
    return this.program.methods
      .updateMinter(address, { add: { quota } })
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        minterConfig: minterPda,
      } as never)
      .rpc();
  }

  async removeMinter(address: PublicKey): Promise<TransactionSignature> {
    const [minterPda] = getMinterPda(this.configPda, address);
    return this.program.methods
      .updateMinter(address, { remove: {} })
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        minterConfig: minterPda,
      } as never)
      .rpc();
  }

  async updateMinterQuota(address: PublicKey, newQuota: BN): Promise<TransactionSignature> {
    const [minterPda] = getMinterPda(this.configPda, address);
    return this.program.methods
      .updateMinter(address, { updateQuota: { newQuota } })
      .accounts({
        authority: this.program.provider.publicKey!,
        config: this.configPda,
        minterConfig: minterPda,
      } as never)
      .rpc();
  }

  // --- Compliance (SSS-2) ---

  async blacklistAdd(address: PublicKey, reason: string): Promise<TransactionSignature> {
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    return this.program.methods
      .addToBlacklist(address, reason)
      .accounts({
        blacklister: this.program.provider.publicKey!,
        config: this.configPda,
        blacklistEntry: blacklistPda,
      } as never)
      .rpc();
  }

  async blacklistRemove(address: PublicKey): Promise<TransactionSignature> {
    const [blacklistPda] = getBlacklistPda(this.configPda, address);
    return this.program.methods
      .removeFromBlacklist(address)
      .accounts({
        blacklister: this.program.provider.publicKey!,
        config: this.configPda,
        blacklistEntry: blacklistPda,
      } as never)
      .rpc();
  }

  async seize(
    sourceTokenAccount: PublicKey,
    treasuryTokenAccount: PublicKey,
    amount: BN,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .seize(amount)
      .accounts({
        seizer: this.program.provider.publicKey!,
        config: this.configPda,
        mint: this.mintAddress,
        sourceTokenAccount,
        treasuryTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as never)
      .rpc();
  }
}
