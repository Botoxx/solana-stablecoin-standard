# TypeScript SDK Reference

Package: `@stbr/sss-token`

## Installation

```bash
yarn add @stbr/sss-token
# or
npm install @stbr/sss-token
```

Peer dependencies: `@coral-xyz/anchor ^0.31.1`, `@solana/web3.js ^1.98.0`, `@solana/spl-token ^0.4.14`.

## Exports

```typescript
// Core classes
export { SolanaStablecoin } from "./stablecoin";
export { ComplianceModule } from "./compliance";

// PDA helpers
export {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
} from "./pda";

// Types and constants
export {
  RoleType,
  ROLE_TYPE_NAMES,
  type RoleTypeValue,
  type CreateStablecoinParams,
  type MintParams,
  type BurnParams,
  type TransferParams,
  type BlacklistParams,
  type SeizeParams,
  type StablecoinState,
  type MinterState,
  type RoleState,
  type BlacklistState,
  type Preset,
} from "./types";

// Presets
export { PRESET_CONFIGS, getPresetConfig } from "./presets";
```

---

## SolanaStablecoin

Main entry point for all stablecoin operations. Wraps both the sss-token and transfer-hook Anchor programs.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `program` | `Program<SssToken>` | Anchor program instance for sss-token |
| `hookProgram` | `Program<TransferHook> \| null` | Transfer hook program (null for SSS-1) |
| `connection` | `Connection` | Solana RPC connection |
| `configPda` | `PublicKey` | Config PDA for this stablecoin |
| `mintAddress` | `PublicKey` | Token mint address |
| `compliance` | `ComplianceModule` | Compliance operations (blacklist, seize) |

### Static Methods

#### `SolanaStablecoin.create(provider, authority, params)`

Creates a new stablecoin with full configuration control.

```typescript
static async create(
  provider: AnchorProvider,
  authority: Keypair,
  params: CreateStablecoinParams
): Promise<SolanaStablecoin>
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `provider` | `AnchorProvider` | Anchor provider with connection and wallet |
| `authority` | `Keypair` | Master authority keypair (pays for account creation) |
| `params` | `CreateStablecoinParams` | Token configuration |

**Example:**

```typescript
const stable = await SolanaStablecoin.create(provider, authority, {
  name: "MyUSD",
  symbol: "MUSD",
  uri: "https://example.com/metadata.json",
  decimals: 6,
  enablePermanentDelegate: true,
  enableTransferHook: true,
  treasury: treasuryPubkey,
});
```

When `enableTransferHook` is `true`, this method also initializes the ExtraAccountMetaList PDA on the transfer-hook program.

#### `SolanaStablecoin.fromPreset(provider, authority, preset, overrides?)`

Creates a stablecoin from a named preset with optional overrides.

```typescript
static fromPreset(
  provider: AnchorProvider,
  authority: Keypair,
  preset: Preset,
  overrides?: Partial<CreateStablecoinParams>
): Promise<SolanaStablecoin>
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `preset` | `"sss-1" \| "sss-2"` | Preset name |
| `overrides` | `Partial<CreateStablecoinParams>` | Override any preset defaults |

**Example:**

```typescript
const stable = await SolanaStablecoin.fromPreset(provider, authority, "sss-2", {
  name: "ComplianceUSD",
  symbol: "CUSD",
  uri: "",
});
```

#### `SolanaStablecoin.load(provider, configPda)`

Loads an existing stablecoin by its config PDA.

```typescript
static async load(
  provider: AnchorProvider,
  configPda: PublicKey
): Promise<SolanaStablecoin>
```

**Example:**

```typescript
const stable = await SolanaStablecoin.load(provider, configPda);
const config = await stable.getConfig();
console.log(`Mint: ${stable.mintAddress.toBase58()}`);
```

#### `SolanaStablecoin.getPrograms(provider)`

Returns raw Anchor program instances for direct access.

```typescript
static getPrograms(provider: AnchorProvider): {
  program: Program<SssToken>;
  hookProgram: Program<TransferHook>;
}
```

### Instance Methods -- Core Operations

#### `mintTokens(minter, recipientTokenAccount, amount)`

Mints tokens to a recipient. Requires the signer to have the Minter role and sufficient quota.

```typescript
async mintTokens(
  minter: Keypair,
  recipientTokenAccount: PublicKey,
  amount: BN
): Promise<TransactionSignature>
```

**Example:**

```typescript
const sig = await stable.mintTokens(
  minterKeypair,
  recipientAta,
  new BN(100_000_000)  // 100 tokens with 6 decimals
);
```

#### `burn(burner, tokenAccount, amount)`

Burns tokens from the burner's own token account. Requires the Burner role.

```typescript
async burn(
  burner: Keypair,
  tokenAccount: PublicKey,
  amount: BN
): Promise<TransactionSignature>
```

#### `freezeAccount(authority, tokenAccount)`

Freezes a token account, preventing all transfers. Requires master authority.

```typescript
async freezeAccount(
  authority: Keypair,
  tokenAccount: PublicKey
): Promise<TransactionSignature>
```

#### `thawAccount(authority, tokenAccount)`

Thaws a frozen token account. Requires master authority.

```typescript
async thawAccount(
  authority: Keypair,
  tokenAccount: PublicKey
): Promise<TransactionSignature>
```

#### `pause(pauser)`

Pauses the entire stablecoin system. All mints, burns, and transfers (via hook) are blocked. Requires the Pauser role.

```typescript
async pause(pauser: Keypair): Promise<TransactionSignature>
```

#### `unpause(pauser)`

Unpauses the system. Requires the Pauser role.

```typescript
async unpause(pauser: Keypair): Promise<TransactionSignature>
```

#### `transfer(payer, source, destination, owner, amount, decimals)`

Executes a transfer using `createTransferCheckedWithTransferHookInstruction`. For SSS-2, this automatically resolves the extra accounts needed by the transfer hook.

```typescript
async transfer(
  payer: Keypair,
  source: PublicKey,
  destination: PublicKey,
  owner: Keypair,
  amount: number,
  decimals: number
): Promise<TransactionSignature>
```

**Example:**

```typescript
const sig = await stable.transfer(
  payer,
  sourceAta,
  destAta,
  ownerKeypair,
  1_000_000,  // 1 token (6 decimals)
  6
);
```

### Instance Methods -- Role Management

#### `addRole(authority, address, role)`

Assigns a role to an address. Requires master authority.

```typescript
async addRole(
  authority: Keypair,
  address: PublicKey,
  role: RoleTypeValue
): Promise<TransactionSignature>
```

**Example:**

```typescript
import { RoleType } from "@stbr/sss-token";

await stable.addRole(authority, pauserPubkey, RoleType.Pauser);
await stable.addRole(authority, blacklisterPubkey, RoleType.Blacklister);
```

#### `removeRole(authority, address, role)`

Revokes a role from an address. Closes the RoleAssignment PDA and returns rent to authority.

```typescript
async removeRole(
  authority: Keypair,
  address: PublicKey,
  role: RoleTypeValue
): Promise<TransactionSignature>
```

#### `addMinter(authority, minterAddress, quota)`

Assigns the Minter role and creates a MinterConfig with the specified quota. This is a convenience method that calls `addRole` followed by `updateMinter`.

```typescript
async addMinter(
  authority: Keypair,
  minterAddress: PublicKey,
  quota: BN
): Promise<TransactionSignature>
```

**Example:**

```typescript
await stable.addMinter(authority, minterPubkey, new BN(1_000_000_000));
// minter can now mint up to 1000 tokens (6 decimals)
```

#### `removeMinter(authority, minterAddress)`

Removes a minter's quota configuration. Closes the MinterConfig PDA.

```typescript
async removeMinter(
  authority: Keypair,
  minterAddress: PublicKey
): Promise<TransactionSignature>
```

#### `updateMinterQuota(authority, minterAddress, newQuota)`

Updates an existing minter's quota. Resets `quota_remaining` to the new value.

```typescript
async updateMinterQuota(
  authority: Keypair,
  minterAddress: PublicKey,
  newQuota: BN
): Promise<TransactionSignature>
```

### Instance Methods -- Authority Transfer

#### `proposeAuthority(authority, newAuthority)`

Proposes a new master authority. The transfer is not finalized until the new authority accepts.

```typescript
async proposeAuthority(
  authority: Keypair,
  newAuthority: PublicKey
): Promise<TransactionSignature>
```

#### `acceptAuthority(newAuthority)`

Accepts a pending authority transfer. Must be signed by the proposed new authority.

```typescript
async acceptAuthority(
  newAuthority: Keypair
): Promise<TransactionSignature>
```

**Example:**

```typescript
// Two-step authority transfer
await stable.proposeAuthority(currentAuthority, newAuthorityPubkey);
await stable.acceptAuthority(newAuthorityKeypair);
```

### Instance Methods -- Queries

#### `getConfig()`

Fetches the current stablecoin configuration.

```typescript
async getConfig(): Promise<StablecoinState>
```

**Returns:** `StablecoinState` with all config fields.

#### `getTotalSupply()`

Returns `totalMinted - totalBurned`.

```typescript
async getTotalSupply(): Promise<BN>
```

#### `getMinter(address)`

Fetches minter configuration for an address. Returns `null` if not a minter.

```typescript
async getMinter(address: PublicKey): Promise<MinterState | null>
```

#### `getRole(address, role)`

Fetches role assignment for an address. Returns `null` if the role is not assigned.

```typescript
async getRole(
  address: PublicKey,
  role: RoleTypeValue
): Promise<RoleState | null>
```

### Instance Methods -- Token Account Helpers

#### `getAssociatedTokenAddress(owner)`

Derives the associated token address for a given owner. Uses Token-2022 program ID.

```typescript
getAssociatedTokenAddress(owner: PublicKey): PublicKey
```

#### `createTokenAccount(payer, owner)`

Creates an associated token account for the stablecoin mint.

```typescript
async createTokenAccount(
  payer: Keypair,
  owner: PublicKey
): Promise<PublicKey>
```

#### `getTokenBalance(tokenAccount)`

Returns the token balance as a `bigint`.

```typescript
async getTokenBalance(tokenAccount: PublicKey): Promise<bigint>
```

---

## ComplianceModule

Handles SSS-2 compliance operations. Accessible via `stable.compliance`.

### Methods

#### `addToBlacklist(blacklister, address, reason)`

Adds an address to the on-chain blacklist. Requires the Blacklister role. Creates a BlacklistEntry PDA.

```typescript
async addToBlacklist(
  blacklister: Keypair,
  address: PublicKey,
  reason: string
): Promise<TransactionSignature>
```

**Constraints:**
- Reason must be non-empty, max 128 characters
- Cannot blacklist an already-active address
- Compliance must be enabled on the stablecoin config

**Example:**

```typescript
await stable.compliance.addToBlacklist(
  blacklisterKeypair,
  sanctionedAddress,
  "OFAC SDN list match - 2024-03-15"
);
```

#### `removeFromBlacklist(blacklister, address)`

Soft-deletes a blacklist entry (sets `active = false`). The PDA is preserved for audit trail.

```typescript
async removeFromBlacklist(
  blacklister: Keypair,
  address: PublicKey
): Promise<TransactionSignature>
```

#### `seize(seizer, sourceTokenAccount, treasuryTokenAccount, amount)`

Seizes tokens from a frozen account and transfers them to the treasury. Requires the Seizer role. The source account must be frozen before calling this method.

```typescript
async seize(
  seizer: Keypair,
  sourceTokenAccount: PublicKey,
  treasuryTokenAccount: PublicKey,
  amount: BN
): Promise<TransactionSignature>
```

**Flow:** thaw -> burn_checked -> mint_to -> re-freeze

**Example:**

```typescript
// Freeze first, then seize
await stable.freezeAccount(authority, targetAta);
const sig = await stable.compliance.seize(
  seizerKeypair,
  targetAta,
  treasuryAta,
  new BN(50_000_000)
);
```

#### `getBlacklistEntry(address)`

Fetches the blacklist entry for an address. Returns `null` if no entry exists.

```typescript
async getBlacklistEntry(
  address: PublicKey
): Promise<BlacklistState | null>
```

#### `isBlacklisted(address)`

Convenience method. Returns `true` if the address has an active blacklist entry.

```typescript
async isBlacklisted(address: PublicKey): Promise<boolean>
```

---

## PDA Helpers

### `getConfigPda(mint)`

```typescript
function getConfigPda(mint: PublicKey): [PublicKey, number]
// Seeds: ["config", mint]
// Program: SSS_TOKEN_PROGRAM_ID
```

### `getMinterPda(config, minter)`

```typescript
function getMinterPda(config: PublicKey, minter: PublicKey): [PublicKey, number]
// Seeds: ["minter", config, minter]
// Program: SSS_TOKEN_PROGRAM_ID
```

### `getRolePda(config, roleType, address)`

```typescript
function getRolePda(
  config: PublicKey,
  roleType: number,
  address: PublicKey
): [PublicKey, number]
// Seeds: ["role", config, [roleType], address]
// Program: SSS_TOKEN_PROGRAM_ID
```

### `getBlacklistPda(config, address)`

```typescript
function getBlacklistPda(config: PublicKey, address: PublicKey): [PublicKey, number]
// Seeds: ["blacklist", config, address]
// Program: SSS_TOKEN_PROGRAM_ID
```

### `getExtraAccountMetasPda(mint)`

```typescript
function getExtraAccountMetasPda(mint: PublicKey): [PublicKey, number]
// Seeds: ["extra-account-metas", mint]
// Program: TRANSFER_HOOK_PROGRAM_ID
```

### Constants

```typescript
const SSS_TOKEN_PROGRAM_ID = new PublicKey("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1");
const TRANSFER_HOOK_PROGRAM_ID = new PublicKey("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");
```

---

## Preset System

### `PRESET_CONFIGS`

```typescript
const PRESET_CONFIGS: Record<Preset, Omit<CreateStablecoinParams, "name" | "symbol" | "uri">> = {
  "sss-1": {
    decimals: 6,
    enablePermanentDelegate: false,
    enableTransferHook: false,
    defaultAccountFrozen: false,
  },
  "sss-2": {
    decimals: 6,
    enablePermanentDelegate: true,
    enableTransferHook: true,
    defaultAccountFrozen: false,
  },
};
```

### `getPresetConfig(preset, overrides?)`

Merges preset defaults with overrides. Generates default name/symbol if not provided.

```typescript
function getPresetConfig(
  preset: Preset,
  overrides?: Partial<CreateStablecoinParams>
): CreateStablecoinParams
```

---

## Type Definitions

### `CreateStablecoinParams`

```typescript
interface CreateStablecoinParams {
  name: string;
  symbol: string;
  uri: string;
  decimals?: number;                   // default: 6
  enablePermanentDelegate?: boolean;   // default: false
  enableTransferHook?: boolean;        // default: false
  defaultAccountFrozen?: boolean;      // default: false
  treasury?: PublicKey;                // default: authority pubkey
}
```

### `StablecoinState`

```typescript
interface StablecoinState {
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
```

### `MinterState`

```typescript
interface MinterState {
  config: PublicKey;
  minter: PublicKey;
  quotaTotal: BN;
  quotaRemaining: BN;
  bump: number;
}
```

### `RoleState`

```typescript
interface RoleState {
  config: PublicKey;
  roleType: number;
  address: PublicKey;
  assignedBy: PublicKey;
  assignedAt: BN;
  bump: number;
}
```

### `BlacklistState`

```typescript
interface BlacklistState {
  config: PublicKey;
  address: PublicKey;
  reason: string;
  blacklistedAt: BN;
  blacklistedBy: PublicKey;
  active: boolean;
  bump: number;
}
```

### `RoleType`

```typescript
const RoleType = {
  Minter: 0,
  Burner: 1,
  Pauser: 2,
  Blacklister: 3,
  Seizer: 4,
} as const;

type RoleTypeValue = 0 | 1 | 2 | 3 | 4;
```

### `Preset`

```typescript
type Preset = "sss-1" | "sss-2";
```

### Parameter Interfaces

```typescript
interface MintParams {
  recipient: PublicKey;
  amount: BN;
}

interface BurnParams {
  tokenAccount: PublicKey;
  amount: BN;
}

interface TransferParams {
  source: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: BN;
}

interface BlacklistParams {
  address: PublicKey;
  reason: string;
}

interface SeizeParams {
  sourceTokenAccount: PublicKey;
  treasuryTokenAccount: PublicKey;
  amount: BN;
}
```

---

## Complete Example

```typescript
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { SolanaStablecoin, RoleType } from "@stbr/sss-token";

// Setup
const provider = AnchorProvider.env();
const authority = Keypair.generate();

// 1. Create SSS-2 stablecoin
const stable = await SolanaStablecoin.fromPreset(provider, authority, "sss-2", {
  name: "ComplianceUSD",
  symbol: "CUSD",
  uri: "https://example.com/cusd.json",
  treasury: treasuryPubkey,
});

// 2. Set up roles
const minter = Keypair.generate();
const pauser = Keypair.generate();
const blacklister = Keypair.generate();
const seizer = Keypair.generate();

await stable.addMinter(authority, minter.publicKey, new BN(1_000_000_000_000));
await stable.addRole(authority, pauser.publicKey, RoleType.Pauser);
await stable.addRole(authority, blacklister.publicKey, RoleType.Blacklister);
await stable.addRole(authority, seizer.publicKey, RoleType.Seizer);

// 3. Mint tokens
const userAta = await stable.createTokenAccount(authority, userPubkey);
await stable.mintTokens(minter, userAta, new BN(100_000_000));

// 4. Query state
const config = await stable.getConfig();
const supply = await stable.getTotalSupply();
const minterState = await stable.getMinter(minter.publicKey);
console.log(`Supply: ${supply.toString()}, Minter remaining: ${minterState.quotaRemaining.toString()}`);

// 5. Compliance: blacklist and seize
await stable.compliance.addToBlacklist(blacklister, badActor, "OFAC SDN match");
await stable.freezeAccount(authority, badActorAta);
await stable.compliance.seize(seizer, badActorAta, treasuryAta, new BN(100_000_000));
```
