import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  TransactionSignature,
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
  MintParams,
  BurnParams,
  TransferParams,
  MinterState,
  RoleState,
  RoleType,
  RoleTypeValue,
  ROLE_TYPE_NAMES,
  StablecoinState,
  Preset,
} from "./types";
import { ComplianceModule } from "./compliance";
import { resolveExtensions } from "./presets";

import sssTokenIdl from "./idl/sss_token.json";
import transferHookIdl from "./idl/transfer_hook.json";

function createProvider(connection: Connection, authority: Keypair): AnchorProvider {
  const wallet = new Wallet(authority);
  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
}

export class SolanaStablecoin {
  public readonly compliance: ComplianceModule;
  public readonly mintAddress: PublicKey;

  private _authority: Keypair;

  private constructor(
    public readonly program: Program<SssToken>,
    public readonly hookProgram: Program<TransferHook> | null,
    public readonly connection: Connection,
    public readonly configPda: PublicKey,
    mint: PublicKey,
    authority: Keypair
  ) {
    this.mintAddress = mint;
    this._authority = authority;
    this.compliance = new ComplianceModule(
      program,
      configPda,
      mint,
      () => this._authority
    );
  }

  get authority(): PublicKey {
    return this._authority.publicKey;
  }

  private static getPrograms(provider: AnchorProvider): {
    program: Program<SssToken>;
    hookProgram: Program<TransferHook>;
  } {
    const program = new Program<SssToken>(sssTokenIdl as any, provider);
    const hookProgram = new Program<TransferHook>(transferHookIdl as any, provider);
    return { program, hookProgram };
  }

  /**
   * Create a new stablecoin.
   *
   * @example
   * ```ts
   * const stable = await SolanaStablecoin.create(connection, {
   *   preset: Presets.SSS_2,
   *   name: "My Stablecoin",
   *   symbol: "MYUSD",
   *   decimals: 6,
   *   authority: adminKeypair,
   * });
   * ```
   */
  static async create(
    connection: Connection,
    params: CreateStablecoinParams
  ): Promise<SolanaStablecoin> {
    const { authority } = params;
    const provider = createProvider(connection, authority);
    const { program, hookProgram } = SolanaStablecoin.getPrograms(provider);

    const ext = resolveExtensions(params.preset, params.extensions);
    const mint = Keypair.generate();
    const [configPda] = getConfigPda(mint.publicKey);
    const treasury = params.treasury ?? authority.publicKey;
    const transferHookProgramId = ext.transferHook ? TRANSFER_HOOK_PROGRAM_ID : null;

    await program.methods
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
        authority: authority.publicKey,
        mint: mint.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([authority, mint])
      .rpc();

    if (ext.transferHook) {
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
      ext.transferHook ? hookProgram : null,
      connection,
      configPda,
      mint.publicKey,
      authority
    );
  }

  /**
   * Load an existing stablecoin by its config PDA.
   */
  static async load(
    connection: Connection,
    configPda: PublicKey,
    authority: Keypair
  ): Promise<SolanaStablecoin> {
    const provider = createProvider(connection, authority);
    const { program, hookProgram } = SolanaStablecoin.getPrograms(provider);
    const config = await program.account.stablecoinConfig.fetch(configPda);
    return new SolanaStablecoin(
      program,
      config.enableTransferHook ? hookProgram : null,
      connection,
      configPda,
      config.mint,
      authority
    );
  }

  // --- Core operations ---

  async mint(params: MintParams): Promise<TransactionSignature> {
    const minter = params.minter ?? this._authority;
    const [minterPda] = getMinterPda(this.configPda, minter.publicKey);

    return this.program.methods
      .mint(params.amount)
      .accounts({
        minter: minter.publicKey,
        minterConfig: minterPda,
        mint: this.mintAddress,
        recipientTokenAccount: params.recipient,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([minter])
      .rpc();
  }

  async burn(params: BurnParams): Promise<TransactionSignature> {
    const burner = params.burner ?? this._authority;
    const tokenAccount =
      params.tokenAccount ??
      getAssociatedTokenAddressSync(
        this.mintAddress,
        burner.publicKey,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

    return this.program.methods
      .burn(params.amount)
      .accounts({
        burner: burner.publicKey,
        mint: this.mintAddress,
        burnerTokenAccount: tokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([burner])
      .rpc();
  }

  async freezeAccount(address: PublicKey): Promise<TransactionSignature> {
    return this.program.methods
      .freezeAccount()
      .accounts({
        authority: this._authority.publicKey,
        mint: this.mintAddress,
        tokenAccount: address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  async thawAccount(address: PublicKey): Promise<TransactionSignature> {
    return this.program.methods
      .thawAccount()
      .accounts({
        authority: this._authority.publicKey,
        mint: this.mintAddress,
        tokenAccount: address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  async pause(pauser?: Keypair): Promise<TransactionSignature> {
    const signer = pauser ?? this._authority;
    const [rolePda] = getRolePda(this.configPda, RoleType.Pauser, signer.publicKey);
    return this.program.methods
      .pause()
      .accounts({ pauser: signer.publicKey } as any)
      .signers([signer])
      .rpc();
  }

  async unpause(pauser?: Keypair): Promise<TransactionSignature> {
    const signer = pauser ?? this._authority;
    const [rolePda] = getRolePda(this.configPda, RoleType.Pauser, signer.publicKey);
    return this.program.methods
      .unpause()
      .accounts({ pauser: signer.publicKey } as any)
      .signers([signer])
      .rpc();
  }

  async transfer(params: TransferParams): Promise<TransactionSignature> {
    const config = await this.getConfig();
    const ix = await createTransferCheckedWithTransferHookInstruction(
      this.connection,
      params.source,
      this.mintAddress,
      params.destination,
      params.owner.publicKey,
      BigInt(params.amount.toString()),
      config.decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    const tx = new anchor.web3.Transaction().add(ix);
    return anchor.web3.sendAndConfirmTransaction(this.connection, tx, [
      params.owner,
    ]);
  }

  // --- Role management ---

  async addRole(
    address: PublicKey,
    role: RoleTypeValue
  ): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    return this.program.methods
      .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as any, { assign: {} })
      .accounts({
        authority: this._authority.publicKey,
        roleAssignment: rolePda,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  async removeRole(
    address: PublicKey,
    role: RoleTypeValue
  ): Promise<TransactionSignature> {
    const [rolePda] = getRolePda(this.configPda, role, address);
    return this.program.methods
      .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as any, { revoke: {} })
      .accounts({
        authority: this._authority.publicKey,
        roleAssignment: rolePda,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  async addMinter(
    address: PublicKey,
    quota: BN
  ): Promise<TransactionSignature> {
    await this.addRole(address, RoleType.Minter);
    const [minterPda] = getMinterPda(this.configPda, address);
    return this.program.methods
      .updateMinter(address, { add: { quota } })
      .accounts({
        authority: this._authority.publicKey,
        minterConfig: minterPda,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  async removeMinter(address: PublicKey): Promise<TransactionSignature> {
    const [minterPda] = getMinterPda(this.configPda, address);
    return this.program.methods
      .updateMinter(address, { remove: {} })
      .accounts({
        authority: this._authority.publicKey,
        minterConfig: minterPda,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  async updateMinterQuota(
    address: PublicKey,
    newQuota: BN
  ): Promise<TransactionSignature> {
    const [minterPda] = getMinterPda(this.configPda, address);
    return this.program.methods
      .updateMinter(address, { updateQuota: { quota: newQuota } })
      .accounts({
        authority: this._authority.publicKey,
        minterConfig: minterPda,
      } as any)
      .signers([this._authority])
      .rpc();
  }

  // --- Authority ---

  async proposeAuthority(newAuthority: PublicKey): Promise<TransactionSignature> {
    return this.program.methods
      .proposeAuthority(newAuthority)
      .accounts({ authority: this._authority.publicKey } as any)
      .signers([this._authority])
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

  async getBlacklistEntry(address: PublicKey): Promise<import("./types").BlacklistState | null> {
    return this.compliance.getBlacklistEntry(address);
  }

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    return this.compliance.isBlacklisted(address);
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
