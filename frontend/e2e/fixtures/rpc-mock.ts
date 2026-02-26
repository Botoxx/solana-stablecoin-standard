import { Page, Route } from "@playwright/test";
import { PublicKey } from "@solana/web3.js";
import { FAKE_SIGNATURE, FAKE_BLOCKHASH, MOCK_CONFIG_PDA } from "./test-wallet";

const SSS_PROGRAM_ID = "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1";
const HOOK_PROGRAM_ID = "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj";

interface AccountEntry {
  data: Buffer;
  owner: string;
}

interface ProgramAccountEntry extends AccountEntry {
  pubkey: string;
}

export class RpcMock {
  private accounts = new Map<string, AccountEntry>();
  private programAccounts = new Map<string, ProgramAccountEntry[]>();
  private nextSendErrorCode: number | null = null;
  private nextSendErrorMsg: string | null = null;
  private sendCount = 0;
  /** Config data used to auto-discover the random configPda */
  private configData: AccountEntry | null = null;
  /** The actual configPda discovered from the first unknown getAccountInfo after create */
  private discoveredConfigPda: string | null = null;

  // --- State management API ---

  setAccount(pubkey: PublicKey | string, data: Buffer, owner = SSS_PROGRAM_ID): void {
    const key = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
    this.accounts.set(key, { data, owner });
  }

  /** Sets config at MOCK_CONFIG_PDA and updates the discovered dynamic config PDA too */
  setConfig(data: Buffer): void {
    this.setAccount(MOCK_CONFIG_PDA, data);
    if (this.discoveredConfigPda) {
      this.accounts.set(this.discoveredConfigPda, { data, owner: SSS_PROGRAM_ID });
    }
    this.configData = { data, owner: SSS_PROGRAM_ID };
  }

  /** Returns the configPda discovered during create flow (random Keypair.generate PDA) */
  getDynamicConfigPda(): string | null {
    return this.discoveredConfigPda;
  }

  setProgramAccounts(programId: string, accounts: ProgramAccountEntry[]): void {
    this.programAccounts.set(programId, accounts);
  }

  addProgramAccount(programId: string, entry: ProgramAccountEntry): void {
    const list = this.programAccounts.get(programId) ?? [];
    list.push(entry);
    this.programAccounts.set(programId, list);
  }

  /** Next sendTransaction will return a program error */
  nextSendError(code: number, msg = "Program error"): void {
    this.nextSendErrorCode = code;
    this.nextSendErrorMsg = msg;
  }

  getSendCount(): number { return this.sendCount; }

  clear(): void {
    this.accounts.clear();
    this.programAccounts.clear();
    this.nextSendErrorCode = null;
    this.nextSendErrorMsg = null;
    this.sendCount = 0;
    this.configData = null;
    this.discoveredConfigPda = null;
  }

  // --- Route handler ---

  async install(page: Page): Promise<void> {
    await page.route(/solana\.com|127\.0\.0\.1:8899/, async (route: Route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.abort();
        return;
      }

      let body: any;
      try {
        body = JSON.parse(request.postData() ?? "{}");
      } catch {
        await route.abort();
        return;
      }

      // Handle batch requests
      if (Array.isArray(body)) {
        const results = body.map((req: any) => this.handleMethod(req.method, req.params, req.id));
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(results) });
        return;
      }

      const result = this.handleMethod(body.method, body.params, body.id);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
    });
  }

  private handleMethod(method: string, params: any[], id: number | string): any {
    const wrap = (result: any) => ({ jsonrpc: "2.0", id, result });
    const error = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

    switch (method) {
      case "getLatestBlockhash":
        return wrap({
          context: { slot: 100 },
          value: { blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: 200 },
        });

      case "getBalance":
        return wrap({ context: { slot: 100 }, value: 10_000_000_000 }); // 10 SOL

      case "getAccountInfo": {
        const pubkey = params[0];
        let entry = this.accounts.get(pubkey);
        if (!entry && this.configData) {
          if (!this.discoveredConfigPda) {
            // First unknown getAccountInfo with config data set → assume it's the configPda
            this.discoveredConfigPda = pubkey;
            this.accounts.set(pubkey, this.configData);
            entry = this.configData;
          } else if (pubkey === this.discoveredConfigPda) {
            entry = this.configData;
          }
        }
        if (!entry) {
          return wrap({ context: { slot: 100 }, value: null });
        }
        return wrap({
          context: { slot: 100 },
          value: {
            data: [entry.data.toString("base64"), "base64"],
            executable: false,
            lamports: 1_000_000,
            owner: entry.owner,
            rentEpoch: 0,
            space: entry.data.length,
          },
        });
      }

      case "getMultipleAccountsInfo": {
        const pubkeys: string[] = params[0];
        const values = pubkeys.map((pk) => {
          const entry = this.accounts.get(pk);
          if (!entry) return null;
          return {
            data: [entry.data.toString("base64"), "base64"],
            executable: false,
            lamports: 1_000_000,
            owner: entry.owner,
            rentEpoch: 0,
            space: entry.data.length,
          };
        });
        return wrap({ context: { slot: 100 }, value: values });
      }

      case "sendTransaction": {
        this.sendCount++;
        if (this.nextSendErrorCode !== null) {
          const code = this.nextSendErrorCode;
          const msg = this.nextSendErrorMsg ?? "Program error";
          this.nextSendErrorCode = null;
          this.nextSendErrorMsg = null;
          if (code >= 0) {
            // Program error — format like Solana RPC with full data envelope
            const hexCode = code.toString(16);
            const errorMsg = `Transaction simulation failed: Error processing Instruction 0: custom program error: 0x${hexCode}`;
            return {
              jsonrpc: "2.0", id,
              error: {
                code: -32002,
                message: errorMsg,
                data: {
                  accounts: null,
                  err: { InstructionError: [0, { Custom: code }] },
                  logs: [
                    `Program ${SSS_PROGRAM_ID} invoke [1]`,
                    `Program log: AnchorError thrown in ${SSS_PROGRAM_ID}. Error Code: ${msg}. Error Number: ${code}`,
                    `Program log: Error Message: ${msg}`,
                    `Program ${SSS_PROGRAM_ID} consumed 25000 of 200000 compute units`,
                    `Program ${SSS_PROGRAM_ID} failed: custom program error: 0x${hexCode}`,
                  ],
                  unitsConsumed: 25000,
                },
              },
            };
          }
          // RPC-level error — pass message directly
          return error(code, msg);
        }
        return wrap(FAKE_SIGNATURE);
      }

      case "confirmTransaction":
        return wrap({ context: { slot: 100 }, value: { err: null } });

      case "getSignatureStatuses":
        return wrap({
          context: { slot: 100 },
          value: (params[0] as string[]).map(() => ({
            slot: 100,
            confirmations: 10,
            err: null,
            confirmationStatus: "confirmed",
          })),
        });

      case "simulateTransaction":
        return wrap({ context: { slot: 100 }, value: { err: null, logs: [], unitsConsumed: 1000 } });

      case "getProgramAccounts": {
        const programId = params[0];
        const entries = this.programAccounts.get(programId) ?? [];
        const result = entries.map((e) => ({
          account: {
            data: [e.data.toString("base64"), "base64"],
            executable: false,
            lamports: 1_000_000,
            owner: e.owner,
            rentEpoch: 0,
            space: e.data.length,
          },
          pubkey: e.pubkey,
        }));
        return wrap(result);
      }

      case "getSlot":
        return wrap(100);

      case "getBlockHeight":
        return wrap(100);

      case "getMinimumBalanceForRentExemption":
        return wrap(890_880);

      case "getFeeForMessage":
        return wrap({ context: { slot: 100 }, value: 5000 });

      case "getRecentBlockhash":
        return wrap({
          context: { slot: 100 },
          value: {
            blockhash: FAKE_BLOCKHASH,
            feeCalculator: { lamportsPerSignature: 5000 },
          },
        });

      case "getEpochInfo":
        return wrap({ epoch: 100, slotIndex: 50, slotsInEpoch: 432000, absoluteSlot: 100, blockHeight: 100 });

      case "getVersion":
        return wrap({ "solana-core": "1.18.0", "feature-set": 0 });

      default:
        // Unknown methods get a null result to avoid crashes
        return wrap(null);
    }
  }
}
