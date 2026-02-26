import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { SssToken } from "../idl/sss_token";
import type { TransferHook } from "../idl/transfer_hook";

/* ---------- deterministic test keys (byte-array, no ed25519) ---------- */
function pk(id: number): PublicKey {
  const b = new Uint8Array(32);
  b[0] = id;
  return new PublicKey(b);
}

const AUTHORITY = pk(1);
const CONFIG = pk(2);
const MINT = pk(3);
const MINTER_PDA = pk(4);
const ROLE_PDA = pk(5);
const BLACKLIST_PDA = pk(6);
const RECIPIENT = pk(7);
const TOKEN_ACCT = pk(8);
const TREASURY = pk(9);
const TARGET = pk(10);
const RECIPIENT_ATA = pk(12);
const SOURCE_ATA = pk(13);
const TREASURY_ATA = pk(14);

/* ---------- mock PDA helpers (findProgramAddressSync fails in jsdom) ---------- */
vi.mock("../lib/constants", async (importOriginal) => {
  const mod = await importOriginal();
  const { PublicKey: PK } = await import("@solana/web3.js");
  const mkPk = (id: number) => {
    const b = new Uint8Array(32);
    b[0] = id;
    return new PK(b);
  };
  return {
    ...(mod as object),
    getConfigPda: vi.fn(() => [mkPk(2), 255]),
    getMinterPda: vi.fn(() => [mkPk(4), 254]),
    getRolePda: vi.fn(() => [mkPk(5), 253]),
    getBlacklistPda: vi.fn(() => [mkPk(6), 252]),
    getExtraAccountMetasPda: vi.fn(() => [mkPk(11), 251]),
  };
});

import { BrowserStablecoin } from "../lib/stablecoin";
import {
  getRolePda,
  RoleType,
} from "../lib/constants";

/* ---------- mock Anchor program ---------- */
interface Call {
  method: string;
  args: unknown[];
  accounts: Record<string, unknown>;
}

function createMockProgram(providerKey: PublicKey) {
  const calls: Call[] = [];
  const methods = new Proxy(
    {},
    {
      get(_, method: string) {
        return (...args: unknown[]) => ({
          accounts: (accs: Record<string, unknown>) => {
            calls.push({ method, args, accounts: accs });
            const chain: Record<string, unknown> = {};
            chain.rpc = vi.fn().mockResolvedValue("mock-sig");
            chain.signers = () => chain;
            chain.preInstructions = () => chain;
            chain.postInstructions = () => chain;
            return chain;
          },
        });
      },
    },
  );
  return {
    program: {
      methods,
      provider: { publicKey: providerKey },
      account: {
        stablecoinConfig: { fetch: vi.fn(), all: vi.fn() },
        minterConfig: { fetch: vi.fn(), all: vi.fn() },
        roleAssignment: { fetch: vi.fn(), all: vi.fn() },
        blacklistEntry: { fetch: vi.fn(), all: vi.fn() },
      },
    } as unknown as Program<SssToken>,
    hookProgram: {
      methods,
      provider: { publicKey: providerKey },
    } as unknown as Program<TransferHook>,
    calls,
  };
}

/* ---------- helpers ---------- */
function keysOf(accs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(accs)) {
    out[k] = v instanceof PublicKey ? v.toBase58() : String(v);
  }
  return out;
}

function rolePdaRoleArg(callIndex: number): number {
  return vi.mocked(getRolePda).mock.calls[callIndex]?.[1] as number;
}

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

describe("BrowserStablecoin", () => {
  let sc: BrowserStablecoin;
  let calls: Call[];

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockProgram(AUTHORITY);
    calls = mock.calls;
    sc = new BrowserStablecoin(mock.program, mock.hookProgram, CONFIG, MINT, true);
  });

  /* ----- mint ----- */
  it("mint: derives ATA, creates it, and passes correct accounts", async () => {
    vi.spyOn(sc, "getAssociatedTokenAddress").mockReturnValue(RECIPIENT_ATA);
    await sc.mint(RECIPIENT, new BN(1000));

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("mint");
    expect(keysOf(calls[0].accounts)).toEqual({
      minter: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
      minterConfig: MINTER_PDA.toBase58(),
      mint: MINT.toBase58(),
      recipientTokenAccount: RECIPIENT_ATA.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Minter);
    expect(sc.getAssociatedTokenAddress).toHaveBeenCalledWith(RECIPIENT);
  });

  /* ----- burn ----- */
  it("burn: derives ATA from wallet and passes correct accounts with Burner role PDA", async () => {
    vi.spyOn(sc, "getAssociatedTokenAddress").mockReturnValue(SOURCE_ATA);
    await sc.burn(new BN(500), TOKEN_ACCT);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("burn");
    expect(sc.getAssociatedTokenAddress).toHaveBeenCalledWith(TOKEN_ACCT);
    expect(keysOf(calls[0].accounts)).toEqual({
      burner: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
      mint: MINT.toBase58(),
      burnerTokenAccount: SOURCE_ATA.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Burner);
  });

  /* ----- freeze / thaw (master authority, no role PDA) ----- */
  it("freezeAccount: derives ATA from wallet and passes correct accounts", async () => {
    vi.spyOn(sc, "getAssociatedTokenAddress").mockReturnValue(SOURCE_ATA);
    await sc.freezeAccount(TOKEN_ACCT);

    expect(calls[0].method).toBe("freezeAccount");
    expect(sc.getAssociatedTokenAddress).toHaveBeenCalledWith(TOKEN_ACCT);
    expect(keysOf(calls[0].accounts)).toEqual({
      authority: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      mint: MINT.toBase58(),
      tokenAccount: SOURCE_ATA.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    });
    expect(getRolePda).not.toHaveBeenCalled();
  });

  it("thawAccount: derives ATA from wallet and passes correct accounts", async () => {
    vi.spyOn(sc, "getAssociatedTokenAddress").mockReturnValue(SOURCE_ATA);
    await sc.thawAccount(TOKEN_ACCT);

    expect(calls[0].method).toBe("thawAccount");
    expect(sc.getAssociatedTokenAddress).toHaveBeenCalledWith(TOKEN_ACCT);
    expect(keysOf(calls[0].accounts)).toEqual({
      authority: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      mint: MINT.toBase58(),
      tokenAccount: SOURCE_ATA.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    });
    expect(getRolePda).not.toHaveBeenCalled();
  });

  /* ----- pause / unpause ----- */
  it("pause: passes correct accounts with Pauser role PDA", async () => {
    await sc.pause();

    expect(calls[0].method).toBe("pause");
    expect(keysOf(calls[0].accounts)).toEqual({
      pauser: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Pauser);
  });

  it("unpause: passes correct accounts with Pauser role PDA", async () => {
    await sc.unpause();

    expect(calls[0].method).toBe("unpause");
    expect(keysOf(calls[0].accounts)).toEqual({
      pauser: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Pauser);
  });

  /* ----- addRole / removeRole ----- */
  it("addRole: calls updateRoles with assign action and correct role variant", async () => {
    await sc.addRole(TARGET, RoleType.Burner);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("updateRoles");
    expect(calls[0].args[0]).toBe(TARGET);
    expect(calls[0].args[1]).toEqual({ burner: {} });
    expect(calls[0].args[2]).toEqual({ assign: {} });
    expect(keysOf(calls[0].accounts)).toEqual({
      authority: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Burner);
  });

  it("removeRole: calls updateRoles with revoke action", async () => {
    await sc.removeRole(TARGET, RoleType.Pauser);

    expect(calls[0].method).toBe("updateRoles");
    expect(calls[0].args[1]).toEqual({ pauser: {} });
    expect(calls[0].args[2]).toEqual({ revoke: {} });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Pauser);
  });

  /* ----- addMinter / removeMinter / updateMinterQuota ----- */
  it("addMinter: assigns Minter role then configures minter with quota", async () => {
    const quota = new BN(1_000_000);
    await sc.addMinter(TARGET, quota);

    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("updateRoles");
    expect(calls[0].args[1]).toEqual({ minter: {} });
    expect(calls[1].method).toBe("updateMinter");
    expect(calls[1].args[0]).toBe(TARGET);
    expect(calls[1].args[1]).toEqual({ add: { quota } });
    expect(keysOf(calls[1].accounts)).toEqual({
      authority: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      minterConfig: MINTER_PDA.toBase58(),
    });
  });

  it("removeMinter: calls updateMinter with remove action", async () => {
    await sc.removeMinter(TARGET);

    expect(calls[0].method).toBe("updateMinter");
    expect(calls[0].args[1]).toEqual({ remove: {} });
  });

  it("updateMinterQuota: calls updateMinter with updateQuota action", async () => {
    const newQuota = new BN(5_000_000);
    await sc.updateMinterQuota(TARGET, newQuota);

    expect(calls[0].method).toBe("updateMinter");
    expect(calls[0].args[1]).toEqual({ updateQuota: { newQuota } });
  });

  /* ----- blacklistAdd / blacklistRemove ----- */
  it("blacklistAdd: passes correct accounts with Blacklister role PDA", async () => {
    await sc.blacklistAdd(TARGET, "OFAC sanctions");

    expect(calls[0].method).toBe("addToBlacklist");
    expect(calls[0].args[0]).toBe(TARGET);
    expect(calls[0].args[1]).toBe("OFAC sanctions");
    expect(keysOf(calls[0].accounts)).toEqual({
      blacklister: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
      blacklistEntry: BLACKLIST_PDA.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Blacklister);
  });

  it("blacklistRemove: passes correct accounts with Blacklister role PDA", async () => {
    await sc.blacklistRemove(TARGET);

    expect(calls[0].method).toBe("removeFromBlacklist");
    expect(keysOf(calls[0].accounts)).toEqual({
      blacklister: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
      blacklistEntry: BLACKLIST_PDA.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Blacklister);
  });

  /* ----- seize ----- */
  it("seize: derives ATAs from wallets and passes correct accounts with Seizer role PDA", async () => {
    vi.spyOn(sc, "getAssociatedTokenAddress")
      .mockReturnValueOnce(SOURCE_ATA)
      .mockReturnValueOnce(TREASURY_ATA);
    await sc.seize(TOKEN_ACCT, TREASURY, new BN(10_000));

    expect(calls[0].method).toBe("seize");
    expect(sc.getAssociatedTokenAddress).toHaveBeenCalledWith(TOKEN_ACCT);
    expect(sc.getAssociatedTokenAddress).toHaveBeenCalledWith(TREASURY);
    expect(keysOf(calls[0].accounts)).toEqual({
      seizer: AUTHORITY.toBase58(),
      config: CONFIG.toBase58(),
      roleAssignment: ROLE_PDA.toBase58(),
      mint: MINT.toBase58(),
      sourceTokenAccount: SOURCE_ATA.toBase58(),
      treasuryTokenAccount: TREASURY_ATA.toBase58(),
      tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    });
    expect(rolePdaRoleArg(0)).toBe(RoleType.Seizer);
  });

  /* ----- query methods ----- */
  it("getState: fetches config account", async () => {
    const mockState = { authority: AUTHORITY, mint: MINT, paused: false };
    vi.mocked((sc as any).program.account.stablecoinConfig.fetch).mockResolvedValue(mockState);
    expect(await sc.getState()).toEqual(mockState);
  });

  it("getMinter: returns null for non-existent account", async () => {
    vi.mocked((sc as any).program.account.minterConfig.fetch).mockRejectedValue(
      new Error("Account does not exist"),
    );
    expect(await sc.getMinter(TARGET)).toBeNull();
  });

  it("getMinter: re-throws non-not-found errors", async () => {
    vi.mocked((sc as any).program.account.minterConfig.fetch).mockRejectedValue(
      new Error("Network error"),
    );
    await expect(sc.getMinter(TARGET)).rejects.toThrow("Network error");
  });

  it("getBlacklistEntry: returns null for non-existent account", async () => {
    vi.mocked((sc as any).program.account.blacklistEntry.fetch).mockRejectedValue(
      new Error("Could not find"),
    );
    expect(await sc.getBlacklistEntry(TARGET)).toBeNull();
  });

  it("getAllMinters: filters by config PDA via memcmp", async () => {
    vi.mocked((sc as any).program.account.minterConfig.all).mockResolvedValue([]);
    await sc.getAllMinters();
    expect((sc as any).program.account.minterConfig.all).toHaveBeenCalledWith([
      { memcmp: { offset: 8, bytes: CONFIG.toBase58() } },
    ]);
  });

  it("getAllRoles: filters by config PDA via memcmp", async () => {
    vi.mocked((sc as any).program.account.roleAssignment.all).mockResolvedValue([]);
    await sc.getAllRoles();
    expect((sc as any).program.account.roleAssignment.all).toHaveBeenCalledWith([
      { memcmp: { offset: 8, bytes: CONFIG.toBase58() } },
    ]);
  });
});
