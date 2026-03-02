import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, TransactionSignature } from "@solana/web3.js";
import { SssOracle } from "./idl/sss_oracle";
import { getOracleFeedPda } from "./pda";
import {
  InitFeedParams,
  FeedConfigUpdates,
  OracleFeedConfig,
  CachedPrice,
} from "./types";

function isAccountNotFoundError(err: any): boolean {
  const msg = err?.message ?? String(err);
  return (
    msg.includes("Account does not exist") || msg.includes("Could not find")
  );
}

export class OracleModule {
  constructor(
    private oracleProgram: Program<SssOracle>,
    private configPda: PublicKey,
    private getAuthority: () => Keypair
  ) {}

  async initializeFeed(
    params: InitFeedParams
  ): Promise<TransactionSignature> {
    const signer = this.getAuthority();
    const pair = encodePair(params.pair);
    const [oracleFeedPda] = getOracleFeedPda(this.configPda, pair);

    return this.oracleProgram.methods
      .initializeFeed({
        pair: Array.from(pair),
        feedAccount: params.feedAccount,
        feedType: params.feedType,
        maxStaleness: params.maxStaleness,
        minSamples: params.minSamples,
        maxConfidence: params.maxConfidence,
        priceDecimals: params.priceDecimals,
        switchboardProgram: params.switchboardProgram,
      })
      .accounts({
        authority: signer.publicKey,
        config: this.configPda,
        oracleFeed: oracleFeedPda,
      } as any)
      .signers([signer])
      .rpc();
  }

  async updateFeedConfig(
    pair: string,
    updates: FeedConfigUpdates
  ): Promise<TransactionSignature> {
    const signer = this.getAuthority();
    const pairBytes = encodePair(pair);
    const [oracleFeedPda] = getOracleFeedPda(this.configPda, pairBytes);

    return this.oracleProgram.methods
      .updateFeedConfig({
        maxStaleness: updates.maxStaleness ?? null,
        minSamples: updates.minSamples ?? null,
        maxConfidence: updates.maxConfidence ?? null,
        priceDecimals: updates.priceDecimals ?? null,
        enabled: updates.enabled ?? null,
        feedAccount: updates.feedAccount ?? null,
      })
      .accounts({
        authority: signer.publicKey,
        oracleFeed: oracleFeedPda,
      } as any)
      .signers([signer])
      .rpc();
  }

  async cachePrice(
    pair: string,
    feedAccount: PublicKey
  ): Promise<TransactionSignature> {
    const pairBytes = encodePair(pair);
    const [oracleFeedPda] = getOracleFeedPda(this.configPda, pairBytes);

    return this.oracleProgram.methods
      .cachePrice()
      .accounts({
        feedAccount,
        oracleFeed: oracleFeedPda,
      } as any)
      .rpc();
  }

  async setManualPrice(
    pair: string,
    price: BN
  ): Promise<TransactionSignature> {
    const signer = this.getAuthority();
    const pairBytes = encodePair(pair);
    const [oracleFeedPda] = getOracleFeedPda(this.configPda, pairBytes);

    return this.oracleProgram.methods
      .setManualPrice(price)
      .accounts({
        authority: signer.publicKey,
        oracleFeed: oracleFeedPda,
      } as any)
      .signers([signer])
      .rpc();
  }

  async closeFeed(pair: string): Promise<TransactionSignature> {
    const signer = this.getAuthority();
    const pairBytes = encodePair(pair);
    const [oracleFeedPda] = getOracleFeedPda(this.configPda, pairBytes);

    return this.oracleProgram.methods
      .closeFeed()
      .accounts({
        authority: signer.publicKey,
        oracleFeed: oracleFeedPda,
      } as any)
      .signers([signer])
      .rpc();
  }

  async getFeedConfig(pair: string): Promise<OracleFeedConfig | null> {
    const pairBytes = encodePair(pair);
    const [oracleFeedPda] = getOracleFeedPda(this.configPda, pairBytes);
    try {
      const feed = await this.oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      return {
        ...feed,
        pair: decodePair(feed.pair),
      } as unknown as OracleFeedConfig;
    } catch (err: any) {
      if (isAccountNotFoundError(err)) return null;
      throw err;
    }
  }

  async getCachedPrice(pair: string): Promise<CachedPrice | null> {
    const config = await this.getFeedConfig(pair);
    if (!config || config.lastCachedPrice.isZero()) return null;
    return {
      price: config.lastCachedPrice,
      slot: config.lastCachedSlot,
      timestamp: config.lastCachedTs,
      decimals: config.priceDecimals,
    };
  }

  async getAllFeeds(): Promise<OracleFeedConfig[]> {
    const accounts =
      await this.oracleProgram.account.oracleFeedConfig.all([
        { memcmp: { offset: 8, bytes: this.configPda.toBase58() } },
      ]);
    return accounts.map((a) => ({
      ...(a.account as any),
      pair: decodePair(a.account.pair),
    })) as unknown as OracleFeedConfig[];
  }
}

export function encodePair(s: string): Buffer {
  const buf = Buffer.alloc(12, 0);
  buf.write(s, "utf8");
  return buf;
}

export function decodePair(bytes: number[] | Uint8Array): string {
  return Buffer.from(bytes)
    .toString("utf8")
    .replace(/\0+$/, "");
}
