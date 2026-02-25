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
  Presets,
  RoleType,
  ROLE_TYPE_NAMES,
  type RoleTypeValue,
  type CreateStablecoinParams,
  type StablecoinExtensions,
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
export { PRESET_EXTENSIONS, resolveExtensions } from "./presets";
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
| `authority` | `PublicKey` | Current authority public key (getter) |
| `compliance` | `ComplianceModule` | Compliance operations (blacklist, seize) |

### Static Methods

#### `SolanaStablecoin.create(connection, params)`

Creates a new stablecoin with full configuration control.

```typescript
static async create(
  connection: Connection,
  params: CreateStablecoinParams
): Promise<SolanaStablecoin>
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `connection` | `Connection` | Solana RPC connection |
| `params` | `CreateStablecoinParams` | Token configuration (includes authority keypair) |

The `params.preset` field selects a preset (`"sss-1"` or `"sss-2"`) which sets default extensions. The `params.extensions` field can override individual extensions. If neither is provided, SSS-1 defaults are used.

When the resolved extensions include `transferHook: true`, this method also initializes the ExtraAccountMetaList PDA on the transfer-hook program.

**Example (with preset):**

```typescript
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "MyUSD",
  symbol: "MUSD",
  uri: "https://example.com/metadata.json",
  decimals: 6,
  authority: authorityKeypair,
  treasury: treasuryPubkey,
});
```

**Example (with manual extensions):**

```typescript
const stable = await SolanaStablecoin.create(connection, {
  name: "MyUSD",
  symbol: "MUSD",
  authority: authorityKeypair,
  extensions: {
    permanentDelegate: true,
    transferHook: true,
    defaultAccountFrozen: false,
  },
});
```

#### `SolanaStablecoin.load(connection, configPda, authority)`

Loads an existing stablecoin by its config PDA.

```typescript
static async load(
  connection: Connection,
  configPda: PublicKey,
  authority: Keypair
): Promise<SolanaStablecoin>
```

**Example:**

```typescript
const stable = await SolanaStablecoin.load(connection, configPda, authorityKeypair);
const config = await stable.getConfig();
console.log(`Mint: ${stable.mintAddress.toBase58()}`);
```

### Instance Methods -- Core Operations

#### `mint(params)`

Mints tokens to a recipient. Requires the signer to have the Minter role and sufficient quota.

```typescript
async mint(params: MintParams): Promise<TransactionSignature>
```

**Example:**

```typescript
const sig = await stable.mint({
  recipient: recipientAta,
  amount: new BN(100_000_000),  // 100 tokens with 6 decimals
  minter: minterKeypair,        // optional, defaults to authority
});
```

#### `burn(params)`

Burns tokens from the burner's own token account. Requires the Burner role.

```typescript
async burn(params: BurnParams): Promise<TransactionSignature>
```

**Example:**

```typescript
const sig = await stable.burn({
  amount: new BN(50_000_000),
  burner: burnerKeypair,       // optional, defaults to authority
  tokenAccount: burnerAta,     // optional, defaults to burner's ATA
});
```

#### `freezeAccount(address)`

Freezes a token account, preventing all transfers. Requires master authority.

```typescript
async freezeAccount(address: PublicKey): Promise<TransactionSignature>
```

#### `thawAccount(address)`

Thaws a frozen token account. Requires master authority.

```typescript
async thawAccount(address: PublicKey): Promise<TransactionSignature>
```

#### `pause(pauser?)`

Pauses the entire stablecoin system. All mints, burns, and transfers (via hook) are blocked. Requires the Pauser role.

```typescript
async pause(pauser?: Keypair): Promise<TransactionSignature>
```

If `pauser` is omitted, the current authority keypair is used.

#### `unpause(pauser?)`

Unpauses the system. Requires the Pauser role.

```typescript
async unpause(pauser?: Keypair): Promise<TransactionSignature>
```

#### `transfer(params)`

Executes a transfer using `createTransferCheckedWithTransferHookInstruction`. For SSS-2, this automatically resolves the extra accounts needed by the transfer hook.

```typescript
async transfer(params: TransferParams): Promise<TransactionSignature>
```

**Example:**

```typescript
const sig = await stable.transfer({
  source: sourceAta,
  destination: destAta,
  owner: ownerKeypair,
  amount: new BN(1_000_000),  // 1 token (6 decimals)
});
```

### Instance Methods -- Role Management

#### `addRole(address, role)`

Assigns a role to an address. Uses the current authority as signer.

```typescript
async addRole(
  address: PublicKey,
  role: RoleTypeValue
): Promise<TransactionSignature>
```

**Example:**

```typescript
import { RoleType } from "@stbr/sss-token";

await stable.addRole(pauserPubkey, RoleType.Pauser);
await stable.addRole(blacklisterPubkey, RoleType.Blacklister);
```

#### `removeRole(address, role)`

Revokes a role from an address. Closes the RoleAssignment PDA and returns rent to authority.

```typescript
async removeRole(
  address: PublicKey,
  role: RoleTypeValue
): Promise<TransactionSignature>
```

#### `addMinter(address, quota)`

Assigns the Minter role and creates a MinterConfig with the specified quota. This is a convenience method that calls `addRole` followed by `updateMinter`.

```typescript
async addMinter(
  address: PublicKey,
  quota: BN
): Promise<TransactionSignature>
```

**Example:**

```typescript
await stable.addMinter(minterPubkey, new BN(1_000_000_000));
// minter can now mint up to 1000 tokens (6 decimals)
```

#### `removeMinter(address)`

Removes a minter's quota configuration. Closes the MinterConfig PDA.

```typescript
async removeMinter(address: PublicKey): Promise<TransactionSignature>
```

#### `updateMinterQuota(address, newQuota)`

Updates an existing minter's quota. Resets `quota_remaining` to the new value.

```typescript
async updateMinterQuota(
  address: PublicKey,
  newQuota: BN
): Promise<TransactionSignature>
```

### Instance Methods -- Authority Transfer

#### `proposeAuthority(newAuthority)`

Proposes a new master authority. The transfer is not finalized until the new authority accepts.

```typescript
async proposeAuthority(
  newAuthority: PublicKey
): Promise<TransactionSignature>
```

#### `acceptAuthority(newAuthority)`

Accepts a pending authority transfer. Must be signed by the proposed new authority. Also updates the internal `_authority` reference.

```typescript
async acceptAuthority(
  newAuthority: Keypair
): Promise<TransactionSignature>
```

**Example:**

```typescript
// Two-step authority transfer
await stable.proposeAuthority(newAuthorityPubkey);
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

#### `getAllMinters()`

Fetches all minter configurations for this stablecoin. Uses a `memcmp` filter on the config field.

```typescript
async getAllMinters(): Promise<MinterState[]>
```

#### `getRole(address, role)`

Fetches role assignment for an address. Returns `null` if the role is not assigned.

```typescript
async getRole(
  address: PublicKey,
  role: RoleTypeValue
): Promise<RoleState | null>
```

#### `getBlacklistEntry(address)`

Fetches the blacklist entry for an address. Delegates to `compliance.getBlacklistEntry`. Returns `null` if no entry exists.

```typescript
async getBlacklistEntry(address: PublicKey): Promise<BlacklistState | null>
```

#### `isBlacklisted(address)`

Returns `true` if the address has an active blacklist entry. Delegates to `compliance.isBlacklisted`.

```typescript
async isBlacklisted(address: PublicKey): Promise<boolean>
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

#### `blacklistAdd(address, reason, blacklister?)`

Adds an address to the on-chain blacklist. Requires the Blacklister role. Creates a BlacklistEntry PDA.

```typescript
async blacklistAdd(
  address: PublicKey,
  reason: string,
  blacklister?: Keypair
): Promise<TransactionSignature>
```

If `blacklister` is omitted, the current authority keypair is used.

**Constraints:**
- Reason must be non-empty, max 128 characters
- Cannot blacklist an already-active address
- Compliance must be enabled on the stablecoin config

**Example:**

```typescript
await stable.compliance.blacklistAdd(
  sanctionedAddress,
  "OFAC SDN list match - 2024-03-15",
  blacklisterKeypair  // optional
);
```

#### `blacklistRemove(address, blacklister?)`

Soft-deletes a blacklist entry (sets `active = false`). The PDA is preserved for audit trail.

```typescript
async blacklistRemove(
  address: PublicKey,
  blacklister?: Keypair
): Promise<TransactionSignature>
```

#### `seize(frozenAccount, treasury, amount, seizer?)`

Seizes tokens from a frozen account and transfers them to the treasury. Requires the Seizer role. The source account must be frozen before calling this method.

```typescript
async seize(
  frozenAccount: PublicKey,
  treasury: PublicKey,
  amount: BN,
  seizer?: Keypair
): Promise<TransactionSignature>
```

**Flow:** thaw -> burn_checked -> mint_to -> re-freeze

**Example:**

```typescript
// Freeze first, then seize
await stable.freezeAccount(targetAta);
const sig = await stable.compliance.seize(
  targetAta,
  treasuryAta,
  new BN(50_000_000),
  seizerKeypair  // optional
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
  roleType: RoleTypeValue,
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

### `PRESET_EXTENSIONS`

```typescript
const PRESET_EXTENSIONS: Record<Preset, Required<StablecoinExtensions>> = {
  "sss-1": {
    permanentDelegate: false,
    transferHook: false,
    defaultAccountFrozen: false,
  },
  "sss-2": {
    permanentDelegate: true,
    transferHook: true,
    defaultAccountFrozen: false,
  },
};
```

### `resolveExtensions(preset?, extensions?)`

Merges preset defaults with optional overrides. If no preset is given, SSS-1 defaults are used as the base.

```typescript
function resolveExtensions(
  preset?: Preset,
  extensions?: StablecoinExtensions
): Required<StablecoinExtensions>
```

---

## Type Definitions

### `CreateStablecoinParams`

```typescript
interface CreateStablecoinParams {
  name: string;
  symbol: string;
  uri?: string;                          // default: ""
  decimals?: number;                     // default: 6
  authority: Keypair;                    // master authority keypair
  treasury?: PublicKey;                  // default: authority pubkey
  preset?: Preset;                       // "sss-1" | "sss-2"
  extensions?: StablecoinExtensions;     // manual extension overrides
}
```

### `StablecoinExtensions`

```typescript
interface StablecoinExtensions {
  permanentDelegate?: boolean;
  transferHook?: boolean;
  defaultAccountFrozen?: boolean;
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
  roleType: RoleTypeValue;
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

### `Presets`

```typescript
const Presets = {
  SSS_1: "sss-1",
  SSS_2: "sss-2",
} as const;

type Preset = "sss-1" | "sss-2";
```

### Parameter Interfaces

```typescript
interface MintParams {
  recipient: PublicKey;       // recipient token account
  amount: BN;
  minter?: Keypair;          // defaults to authority
}

interface BurnParams {
  amount: BN;
  burner?: Keypair;          // defaults to authority
  tokenAccount?: PublicKey;  // defaults to burner's ATA
}

interface TransferParams {
  source: PublicKey;
  destination: PublicKey;
  owner: Keypair;
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
import { Connection, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { SolanaStablecoin, Presets, RoleType } from "@stbr/sss-token";

// Setup
const connection = new Connection("http://localhost:8899", "confirmed");
const authority = Keypair.generate();

// 1. Create SSS-2 stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "ComplianceUSD",
  symbol: "CUSD",
  uri: "https://example.com/cusd.json",
  authority,
  treasury: treasuryPubkey,
});

// 2. Set up roles
const minter = Keypair.generate();
const pauser = Keypair.generate();
const blacklister = Keypair.generate();
const seizer = Keypair.generate();

await stable.addMinter(minter.publicKey, new BN(1_000_000_000_000));
await stable.addRole(pauser.publicKey, RoleType.Pauser);
await stable.addRole(blacklister.publicKey, RoleType.Blacklister);
await stable.addRole(seizer.publicKey, RoleType.Seizer);

// 3. Mint tokens
const userAta = await stable.createTokenAccount(authority, userPubkey);
await stable.mint({ recipient: userAta, amount: new BN(100_000_000), minter });

// 4. Query state
const config = await stable.getConfig();
const supply = await stable.getTotalSupply();
const minterState = await stable.getMinter(minter.publicKey);
const allMinters = await stable.getAllMinters();
console.log(`Supply: ${supply.toString()}, Minter remaining: ${minterState.quotaRemaining.toString()}`);

// 5. Compliance: blacklist and seize
await stable.compliance.blacklistAdd(badActor, "OFAC SDN match", blacklister);
await stable.freezeAccount(badActorAta);
await stable.compliance.seize(badActorAta, treasuryAta, new BN(100_000_000), seizer);
```
