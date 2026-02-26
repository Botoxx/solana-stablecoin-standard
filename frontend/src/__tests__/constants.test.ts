import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
  resolveExtensions,
  Presets,
  PRESET_EXTENSIONS,
  RoleType,
  ROLE_TYPE_NAMES,
  ERROR_MESSAGES,
} from "../lib/constants";

// NOTE: PDA derivation (getConfigPda, getMinterPda, etc.) is not testable in
// vitest+jsdom due to @noble/curves ed25519 incompatibility on Node 25.
// PDA correctness is verified in the Anchor integration test suite.

describe("constants", () => {
  it("program IDs are valid PublicKeys", () => {
    expect(SSS_TOKEN_PROGRAM_ID).toBeInstanceOf(PublicKey);
    expect(TRANSFER_HOOK_PROGRAM_ID).toBeInstanceOf(PublicKey);
  });

  it("program IDs match expected addresses", () => {
    expect(SSS_TOKEN_PROGRAM_ID.toBase58()).toBe("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1");
    expect(TRANSFER_HOOK_PROGRAM_ID.toBase58()).toBe("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");
  });
});

describe("resolveExtensions", () => {
  it("SSS-1 has no extensions", () => {
    const ext = resolveExtensions(Presets.SSS_1);
    expect(ext.permanentDelegate).toBe(false);
    expect(ext.transferHook).toBe(false);
    expect(ext.defaultAccountFrozen).toBe(false);
  });

  it("SSS-2 has permanentDelegate and transferHook", () => {
    const ext = resolveExtensions(Presets.SSS_2);
    expect(ext.permanentDelegate).toBe(true);
    expect(ext.transferHook).toBe(true);
    expect(ext.defaultAccountFrozen).toBe(false);
  });

  it("overrides take precedence", () => {
    const ext = resolveExtensions(Presets.SSS_1, { permanentDelegate: true });
    expect(ext.permanentDelegate).toBe(true);
    expect(ext.transferHook).toBe(false);
  });

  it("defaults to SSS-1 when no preset given", () => {
    const ext = resolveExtensions(undefined);
    expect(ext).toEqual(PRESET_EXTENSIONS[Presets.SSS_1]);
  });
});

describe("RoleType", () => {
  it("has 5 roles", () => {
    expect(Object.keys(RoleType)).toHaveLength(5);
  });

  it("values are sequential from 0", () => {
    expect(RoleType.Minter).toBe(0);
    expect(RoleType.Burner).toBe(1);
    expect(RoleType.Pauser).toBe(2);
    expect(RoleType.Blacklister).toBe(3);
    expect(RoleType.Seizer).toBe(4);
  });

  it("ROLE_TYPE_NAMES maps all values", () => {
    for (const val of Object.values(RoleType)) {
      expect(ROLE_TYPE_NAMES[val]).toBeDefined();
    }
  });
});

describe("ERROR_MESSAGES", () => {
  it("has entries for codes 6000-6023", () => {
    for (let i = 6000; i <= 6023; i++) {
      expect(ERROR_MESSAGES[i]).toBeDefined();
    }
  });

  it("6000 is Unauthorized", () => {
    expect(ERROR_MESSAGES[6000]).toContain("Unauthorized");
  });

  it("6001 is Paused", () => {
    expect(ERROR_MESSAGES[6001]).toContain("paused");
  });
});
