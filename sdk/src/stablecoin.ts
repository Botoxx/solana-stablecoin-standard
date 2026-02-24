import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  TransactionSignature,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";
import { SssToken } from "./idl/sss_token";
import { TransferHook } from "./idl/transfer_hook";
import {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getExtraAccountMetasPda,
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
} from "./pda";
import {
  CreateStablecoinParams,
  MinterState,
  RoleState,
  RoleType,
  RoleTypeValue,
  ROLE_TYPE_NAMES,
  StablecoinState,
} from "./types";
import { ComplianceModule } from "./compliance";
import { getPresetConfig } from "./presets";
import type { Preset } from "./types";

import sssTokenIdl from "./idl/sss_token.json";
import transferHookIdl from "./idl/transfer_hook.json";

export class SolanaStablecoin {
  public readonly compliance: ComplianceModule;
  public readonly mintAddress: PublicKey;

  private constructor(
    public readonly program: Program<SssToken>,
    public readonly hookProgram: Program<TransferHook> | null,
    public readonly connection: Connection,
    public readonly configPda: PublicKey,
    mint: PublicKey
  ) {
    this.mintAddress = mint;
    this.compliance = new ComplianceModule(program, configPda, mint);
  }

  static getPrograms(provider: AnchorProvider): {
    program: Program<SssToken>;
    hookProgram: Program<TransferHook>;
  } {
    const program = new Program<SssToken>(sssTokenIdl as any, provider);
    const hookProgram = new Program<TransferHook>(transferHookIdl as any, provider);
    return { program, hookProgram };
  }

  static async create(
    provider: AnchorProvider,
    authority: Keypair,
    params: CreateStablecoinParams
  ): Promise<SolanaStablecoin> {
    const { program, hookProgram } = SolanaStablecoin.getPrograms(provider);
    const mint = Keypair.generate();
    const [configPda] = getConfigPda(mint.publicKey);
    const treasury = params.treasury ?? authority.publicKey;
    const enableTransferHook = params.enableTransferHook ?? false;
    const transferHookProgramId = enableTransferHook ? TRANSFER_HOOK_PROGRAM_ID : null;

    await program.methods
      .initialize({
        name: params.name,
        symbol: params.symbol,
        uri: params.uri,
        decimals: params.decimals ?? 6,
        enablePermanentDelegate: params.enablePermanentDelegate ?? false,
        enableTransferHook,
        defaultAccountFrozen: params.defaultAccountFrozen ?? false,
        transferHookProgramId,
        treasury,
      })
      .accounts({
        authority: authority.publicKey,
        mint: mint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([authority, mint])
      .rpc();

    if (enableTransferHook) {
      const [extraAccountMetasPda] = getExtraAccountMetasPda(mint.publicKey);
      await hookProgram.methods
        .initializeExtraAccountMetaList(SSS_TOKEN_PROGRAM_ID)
        .accounts({
          payer: authority.publicKey,
          extraAccountMetaList: extraAccountMetasPda,
          mint: mint.publicKey,
          config: configPda,
        } as any)
        .signers([authority])
        .rpc();
    }

    return new SolanaStablecoin(
      program,
      enableTransferHook ? hookProgram : null,
      provider.connection,
      configPda,
      mint.publicKey
    );
  }

  static fromPreset(
    provider: AnchorProvider,
    authority: Keypair,
    preset: Preset,
    overrides: Partial<CreateStablecoinParams> = {}
  ): Promise<SolanaStablecoin> {
    return SolanaStablecoin.create(provider, authority, getPresetConfig(preset, overrides));
  }

  static async load(
    provider: AnchorProvider,
    configPda: PublicKey
  ): Promise<SolanaStablecoin> {
    const { program, hookProgram } = SolanaStablecoin.getPrograms(provider);
    const config = await program.account.stablecoinConfig.fetch(configPda);
    return new SolanaStablecoin(
      program,
      config.enableTransferHook ? hookProgram : null,
      provider.connection,
      configPda,
      config.mint
    );
  }

  // --- Core operations ---

  async mintTokens(
    minter: Keypair,
    recipientTokenAccount: PublicKey,
    amount: BN
  ): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, RoleType.Minter, minter.publicKey);
    const [minterPda] = getMinterPda(this.configPda, minter.publicKey);

    return this.program.methods
      .mint(amount)
      .accounts({
        minter: minter.publicKey,
        minterConfig: minterPda,
        mint: this.mintAddress,
        recipientTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([minter])
      .rpc();
  }

  async burn(
    burner: Keypair,
    tokenAccount: PublicKey,
    amount: BN
  ): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, RoleType.Burner, burner.publicKey);

    return this.program.methods
      .burn(amount)
      .accounts({
        burner: burner.publicKey,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([burner])
      .rpc();
  }

  async freezeAccount(
    authority: Keypair,
    tokenAccount: PublicKey
  ): Promise<TransactionSignature> {
    return this.program.methods
      .freezeAccount()
      .accounts({
        authority: authority.publicKey,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([authority])
      .rpc();
  }

  async thawAccount(
    authority: Keypair,
    tokenAccount: PublicKey
  ): Promise<TransactionSignature> {
    return this.program.methods
      .thawAccount()
      .accounts({
        authority: authority.publicKey,
        mint: this.mintAddress,
        tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([authority])
      .rpc();
  }

  async pause(pauser: Keypair): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, RoleType.Pauser, pauser.publicKey);
    return this.program.methods
      .pause()
      .accounts({ pauser: pauser.publicKey } as any)
      .signers([pauser])
      .rpc();
  }

  async unpause(pauser: Keypair): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, RoleType.Pauser, pauser.publicKey);
    return this.program.methods
      .unpause()
      .accounts({ pauser: pauser.publicKey } as any)
      .signers([pauser])
      .rpc();
  }

  async transfer(
    payer: Keypair,
    source: PublicKey,
    destination: PublicKey,
    owner: Keypair,
    amount: number,
    decimals: number
  ): Promise<TransactionSignature> {
    const ix = await createTransferCheckedWithTransferHookInstruction(
      this.connection,
      source,
      this.mintAddress,
      destination,
      owner.publicKey,
      BigInt(amount),
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const tx = new anchor.web3.Transaction().add(ix);
    return anchor.web3.sendAndConfirmTransaction(this.connection, tx, [payer, owner]);
  }

  // --- Role management ---

  async addRole(
    authority: Keypair,
    address: PublicKey,
    role: RoleTypeValue
  ): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    return this.program.methods
      .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as any, { assign: {} })
      .accounts({
        authority: authority.publicKey,
        roleAssignment: rolePda,
      } as any)
      .signers([authority])
      .rpc();
  }

  async removeRole(
    authority: Keypair,
    address: PublicKey,
    role: RoleTypeValue
  ): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    return this.program.methods
      .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as any, { revoke: {} })
      .accounts({
        authority: authority.publicKey,
        roleAssignment: rolePda,
      } as any)
      .signers([authority])
      .rpc();
  }

  async addMinter(
    authority: Keypair,
    minterAddress: PublicKey,
    quota: BN
  ): Promise<TransactionSignature> {
    await this.addRole(authority, minterAddress, RoleType.Minter);
    const [minterPda] = getMinterPda(this.configPda, minterAddress);
    return this.program.methods
      .updateMinter(minterAddress, { add: { quota } })
      .accounts({
        authority: authority.publicKey,
        minterConfig: minterPda,
      } as any)
      .signers([authority])
      .rpc();
  }

  async removeMinter(
    authority: Keypair,
    minterAddress: PublicKey
  ): Promise<TransactionSignature> {
    const [minterPda] = getMinterPda(this.configPda, minterAddress);
    return this.program.methods
      .updateMinter(minterAddress, { remove: {} })
      .accounts({
        authority: authority.publicKey,
        minterConfig: minterPda,
      } as any)
      .signers([authority])
      .rpc();
  }

  async updateMinterQuota(
    authority: Keypair,
    minterAddress: PublicKey,
    newQuota: BN
  ): Promise<TransactionSignature> {
    const [minterPda] = getMinterPda(this.configPda, minterAddress);
    return this.program.methods
      .updateMinter(minterAddress, { updateQuota: { quota: newQuota } })
      .accounts({
        authority: authority.publicKey,
        minterConfig: minterPda,
      } as any)
      .signers([authority])
      .rpc();
  }

  // --- Authority ---

  async proposeAuthority(
    authority: Keypair,
    newAuthority: PublicKey
  ): Promise<TransactionSignature> {
    return this.program.methods
      .proposeAuthority(newAuthority)
      .accounts({ authority: authority.publicKey } as any)
      .signers([authority])
      .rpc();
  }

  async acceptAuthority(newAuthority: Keypair): Promise<TransactionSignature> {
    return this.program.methods
      .acceptAuthority()
      .accounts({ newAuthority: newAuthority.publicKey } as any)
      .signers([newAuthority])
      .rpc();
  }

  // --- Queries ---

  async getConfig(): Promise<StablecoinState> {
    return (await this.program.account.stablecoinConfig.fetch(
      this.configPda
    )) as unknown as StablecoinState;
  }

  async getTotalSupply(): Promise<BN> {
    const config = await this.getConfig();
    return config.totalMinted.sub(config.totalBurned);
  }

  async getMinter(address: PublicKey): Promise<MinterState | null> {
    const [minterPda] = getMinterPda(this.configPda, address);
    try {
      return (await this.program.account.minterConfig.fetch(minterPda)) as unknown as MinterState;
    } catch {
      return null;
    }
  }

  async getRole(address: PublicKey, role: RoleTypeValue): Promise<RoleState | null> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    try {
      return (await this.program.account.roleAssignment.fetch(rolePda)) as unknown as RoleState;
    } catch {
      return null;
    }
  }

  // --- Token account helpers ---

  getAssociatedTokenAddress(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.mintAddress,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  async createTokenAccount(payer: Keypair, owner: PublicKey): Promise<PublicKey> {
    const ata = this.getAssociatedTokenAddress(owner);
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        this.mintAddress,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await anchor.web3.sendAndConfirmTransaction(this.connection, tx, [payer]);
    return ata;
  }

  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    const bal = await this.connection.getTokenAccountBalance(tokenAccount);
    return BigInt(bal.value.amount);
  }
}
