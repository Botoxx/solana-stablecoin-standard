import {
  BaseSignerWalletAdapter,
  WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";

const TEST_SEED = new Uint8Array(32).fill(1);
const TEST_KEYPAIR = Keypair.fromSeed(TEST_SEED);

export class TestWalletAdapter extends BaseSignerWalletAdapter {
  name = "E2E Test Wallet" as WalletName;
  url = "https://test" as const;
  icon = "data:image/svg+xml;base64,PHN2Zy8+" as const;
  readyState = WalletReadyState.Installed;
  connecting = false;
  supportedTransactionVersions = null;

  private _connected = false;
  get connected() { return this._connected; }
  get publicKey() { return this._connected ? TEST_KEYPAIR.publicKey : null; }

  async connect(): Promise<void> {
    this.connecting = true;
    this._connected = true;
    this.connecting = false;
    this.emit("connect", TEST_KEYPAIR.publicKey);
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(TEST_KEYPAIR);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) {
      if (tx instanceof Transaction) {
        tx.partialSign(TEST_KEYPAIR);
      }
    }
    return txs;
  }
}

export { TEST_KEYPAIR };
export const TEST_PUBKEY = TEST_KEYPAIR.publicKey;
