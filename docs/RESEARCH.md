# Research & Technical Reference

Findings from the bounty listing, reference implementation, Solana documentation, and regulatory context. This supplements `SPECIFICATION.md` with implementation-critical details not covered there.

---

## 1. Quality Benchmark: Solana Vault Standard

The [Vault Standard](https://github.com/solanabr/solana-vault-standard) is the explicit quality benchmark. Key patterns to adopt:

### Program Module Layout

```
programs/<name>/src/
  lib.rs              # declare_id!, thin wrappers → instructions::handler()
  instructions/
    mod.rs            # re-exports
    initialize.rs     # one file per instruction
    ...
  state.rs            # Account structs with explicit LEN const
  error.rs            # #[error_code] enum
  events.rs           # #[event] structs for indexing
  math.rs             # Pure arithmetic, no side effects
  constants.rs        # PDA seeds, limits, magic numbers
```

### State Account Pattern

```rust
#[account]
pub struct Vault {
    pub authority: Pubkey,
    // ... fields ...
    pub bump: u8,
    pub paused: bool,
    pub _reserved: [u8; 64],  // future upgrades without realloc
}

impl Vault {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // authority
        // ... explicit per-field sizing
        64;   // _reserved

    pub const SEED_PREFIX: &'static [u8] = b"vault";
}
```

### Cargo Release Profile

```toml
[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
```

### Pinned Dependencies

| Crate | Version |
|-------|---------|
| anchor-lang | 0.31.1 (features: init-if-needed) |
| anchor-spl | 0.31.1 (features: token, associated_token, metadata) |
| spl-token-2022 | 6.0.0 |
| spl-token-metadata-interface | 0.5.1 |
| @coral-xyz/anchor | ^0.31.1 |
| @solana/spl-token | ^0.4.10 |
| @solana/web3.js | ^1.98.0 |

### SDK Pattern

- Yarn workspaces for multi-package SDK
- Class-based TypeScript with interface-first design (`VaultState`, `CreateVaultParams`, etc.)
- Auto-detect token program owner (TOKEN_PROGRAM_ID vs TOKEN_2022_PROGRAM_ID)
- Separate `pda.ts` for address derivation, `math.ts` for client-side arithmetic

### Testing

- ts-mocha with `-t 1000000` timeout
- Dedicated test file per variant + cross-cutting tests (edge-cases, invariants, multi-user)
- `tests/helpers/` directory for shared utilities
- 114+ integration tests in the vault standard
- Trident for fuzz testing

---

## 2. Token-2022 Extensions — Implementation Details

### 2.1 Permanent Delegate (SSS-2: seizure)

Grants irrevocable, mint-wide delegate authority over every token account for a given mint.

**Behavior:**
- Can transfer or burn tokens from any account holding the mint
- Token account owners **cannot** revoke the delegate
- Only the current delegate can reassign to a new account
- Single point of failure if delegate key is compromised

**Initialization sequence** (order matters):
1. Calculate mint account size with extension: `ExtensionType::try_calculate_account_len::<Mint>(&[PermanentDelegate])`
2. Create mint account with sufficient space
3. `initialize_permanent_delegate(&TOKEN_2022_PROGRAM_ID, &mint, &delegate)` — **before** mint init
4. Initialize mint with standard parameters

**Rust:**
```rust
let ix = initialize_permanent_delegate(
    &TOKEN_2022_PROGRAM_ID,
    &mint.pubkey(),
    &delegate.pubkey(),
)?;
```

**TypeScript (legacy):**
```typescript
createInitializePermanentDelegateInstruction(
    mint.publicKey,
    delegate.publicKey,
    TOKEN_2022_PROGRAM_ID,
);
```

**Reading the extension:**
```rust
let mint_state = StateWithExtensions::<Mint>::unpack(&mint_account.data)?;
let permanent_delegate = mint_state.get_extension::<PermanentDelegate>()?;
```

### 2.2 Transfer Hook (SSS-2: blacklist enforcement)

Executes custom logic on every token transfer via CPI from the Token Extensions program.

**Critical constraints:**
- All accounts from the initial transfer become **read-only** in the hook
- Sender's signer privileges do **not** extend to the hook program
- Account order in the hook context struct must match Token Extensions program expectations

**Three required instructions:**
1. `execute` — invoked on every transfer by Token Extensions program
2. `InitializeExtraAccountMetaList` — creates PDA storing additional required accounts
3. `UpdateExtraAccountMetaList` — updates the extra accounts list

**Extra Account Metas PDA:**
```
seeds = ["extra-account-metas", mint.toBuffer()]
```

**Anchor discriminator mismatch** — the Transfer Hook Interface uses different instruction discriminators than Anchor. Requires a fallback handler:

```rust
pub fn fallback<'info>(
    program_id: &Pubkey,
    accounts: &'info [AccountInfo<'info>],
    data: &[u8],
) -> Result<()> {
    let instruction = TransferHookInstruction::unpack(data)?;
    match instruction {
        TransferHookInstruction::Execute { amount } => {
            __private::__global::transfer_hook(
                program_id, accounts, &amount.to_le_bytes()
            )
        }
        _ => Err(ProgramError::InvalidInstructionData.into()),
    }
}
```

**Direct invocation attack prevention** — anyone can call the execute instruction directly. Must verify the `transferring` flag:

```rust
fn assert_is_transferring(ctx: &Context<TransferHook>) -> Result<()> {
    let source_token_info = ctx.accounts.source_token.to_account_info();
    let mut account_data = source_token_info.try_borrow_mut_data()?;
    let account = PodStateWithExtensionsMut::<PodAccount>::unpack(*account_data)?;
    let extension = account.get_extension_mut::<TransferHookAccount>()?;
    if !bool::from(extension.transferring) {
        return err!(TransferError::IsNotCurrentlyTransferring);
    }
    Ok(())
}
```

**TypeScript client helper** (auto-resolves extra account metas):
```typescript
const ix = await createTransferCheckedWithTransferHookInstruction(
    connection,
    sourceTokenAccount,
    mint.publicKey,
    destinationTokenAccount,
    wallet.publicKey,
    amountBigInt,
    decimals,
    [],
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
);
```

**Extra account meta storage options:**
- Direct pubkey: `ExtraAccountMeta::new_with_pubkey(&account.key(), false, false)`
- Program PDA: `ExtraAccountMeta::new_with_seeds(&[Seed::Literal { bytes }], false, false)`
- External PDA: `ExtraAccountMeta::new_external_pda_with_seeds(program_index, &[Seed::AccountKey { index }], false, true)`
- Account data as seed: `Seed::AccountData { account_index, data_index, length }`

### 2.3 Extension Compatibility Matrix

| Combination | Status |
|-------------|--------|
| Permanent delegate + transfer hook | **Compatible** (SSS-2 uses this) |
| Metadata extension + anything | **Compatible** |
| Transfer hook + confidential transfers | **NOT compatible** (fix pending) |
| Confidential transfers (standalone) | **Disabled** on mainnet/devnet (security audit) |

### 2.4 Confidential Transfers (Bonus SSS-3)

Encrypts balances and transfer amounts using ElGamal + AES dual-key scheme.

**Balance states:** public → (deposit) → pending → (apply) → available → (withdraw) → public

**Per-transfer ZK proofs (3):**
1. Equality proof — sender's deduction matches recipient's credit
2. Ciphertext validity proof — ciphertext is properly formed
3. Range proof — amount is non-negative and within bounds

**Current blockers:**
- ZK ElGamal Proof Program disabled on mainnet/devnet during security audit
- Incompatible with transfer hooks — SSS-3 cannot enforce blacklists via transfer hook

**Implication for SSS-3:** Must use a different compliance mechanism (e.g., allowlists instead of blacklists, or auditor key with ElGamal).

---

## 3. GENIUS Act — Regulatory Context for SSS-2

The GENIUS Act (Guiding and Establishing National Innovation for US Stablecoins) creates the regulatory framework for "Permitted Payment Stablecoin Issuers" (PPSIs). SSS-2's features map directly to these requirements.

### Mandatory Technical Capabilities

| Requirement | SSS-2 Implementation |
|-------------|---------------------|
| Block, freeze, reject impermissible transactions | `freeze_account` + `add_to_blacklist` |
| Secondary market enforcement (third-party transfers) | Transfer hook checks both sender and recipient |
| Sanctions screening (OFAC SDN List) | Blacklist with `reason` field |
| Confiscation capability | `seize` via permanent delegate |
| Audit trail with operator identity | Anchor events with authority pubkey + timestamp |
| Annual compliance certification | Queryable event history + audit-log CLI command |

### KYC/AML

- FinCEN creating dedicated BSA category for stablecoin issuers
- Customer Identification Program (CIP) and Customer Due Diligence (CDD) required
- Tailored to issuer "size and complexity" — our backend compliance service is the integration point

### Design Implications

1. **Blacklist `reason` field is not optional** — regulators need OFAC match, court order, law enforcement request, etc.
2. **All compliance operations must log operator identity** — the signing authority must appear in events
3. **Seize must be fully auditable** — source account, destination treasury, amount, reason, authority, timestamp
4. **Per-minter quotas** align with issuance controls regulators expect
5. **Role separation** (blacklister ≠ seizer ≠ minter) prevents single-key dominance — regulatory expectation, not just good practice
6. **Criminal penalties** for false compliance certification — the audit trail must be tamper-evident (on-chain events satisfy this)

---

## 4. Submission Mechanics

- PR to `github.com/solanabr/solana-stablecoin-standard`
- Reviewer: @kauenet
- Must include: source code, passing tests, devnet deployment proof (program IDs + txs), documentation suite, Docker Compose
- PRs that incorporate reviewer feedback score higher
- Winning submission may become a Superteam production product (MIT license)
- Non-winning submissions remain builder property

---

## 5. External Ecosystem Research — Existing Stablecoin Implementations

### 5.1 USDC on Solana (Circle)

**Current status:** USDC is natively supported on Solana using the legacy SPL Token program (not Token-2022). Circle minted $750M USDC on Solana in early 2026, demonstrating continued commitment. Visa launched USDC settlement in the US in December 2025 over the Solana blockchain via Cross River Bank and Lead Bank.

**Token-2022 migration:** USDC itself has not migrated to Token-2022. However, Circle's newer products (USYC tokenized money market fund) use SPL Token-2022 for token and custody flows, signaling future direction. The core USDC mint remains on legacy SPL Token for backwards compatibility with the massive existing ecosystem.

**Compliance features (current SPL Token):**
- Freeze authority retained by Circle — can freeze any token account
- Mint authority retained — only Circle can mint/burn
- No on-chain blacklist — freeze authority serves as the blacklist mechanism (freeze = effectively blacklisted)
- No transfer hook — compliance enforced at the freeze/thaw level

**Circle's EVM reference architecture** (circlefin/stablecoin-evm) is the canonical design for fiat-backed stablecoins with these roles:
- **Admin**: Proxy upgrades (`upgradeTo`/`upgradeToAndCall`)
- **Owner**: Reassigns all roles except admin
- **MasterMinter**: Manages minter lifecycle (`configureMinter`, `removeMinter`)
- **Minter**: Issues/destroys tokens, each with individual allowance quota
- **Pauser**: Emergency freeze (`pause`/`unpause`)
- **Blacklister**: Address restrictions (`blacklist`/`unblacklist`)
- **Rescuer**: Recovers accidentally locked ERC-20 tokens

Key design patterns from Circle EVM:
- Per-minter allowance quotas that decrement on mint and are periodically reset
- Pause blocks all transfers, minting, burning, and adding minters (admin functions remain active)
- Blacklist integrated into transfer flow — checked on every transfer, mint, and burn
- `minterAllowance` explicitly designed to "limit the damage if any particular minter is compromised"
- Burn does NOT restore allowance — deliberate design choice

**SSS-2 alignment:** The specification's RBAC model (Master Authority, Minter with quotas, Pauser, Blacklister, Seizer) directly mirrors Circle's EVM architecture. SSS-2 is essentially the Solana-native equivalent.

**Cross-Chain Transfer Protocol (CCTP):**
- [circlefin/solana-cctp-contracts](https://github.com/circlefin/solana-cctp-contracts) — Anchor-based, Rust (65.4%) + TypeScript (33.7%)
- V1 programs: `CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd` (MessageTransmitter), `CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3` (TokenMessengerMinter)
- V2 programs deployed separately with new program IDs
- Burns USDC on source chain, mints on destination — no bridge liquidity pools or wrapped tokens
- Cargo dependencies vendored locally for reproducible builds
- Uses `backpackapp/build:v0.28.0` Docker image for verifiable Anchor builds
- CCTP V2 (March 2025): Fast Transfer reduces settlement to seconds

**Sources:**
- [Circle USDC on Solana](https://www.circle.com/multi-chain-usdc/solana)
- [Circle Stablecoin EVM (GitHub)](https://github.com/circlefin/stablecoin-evm)
- [Circle EVM Token Design](https://github.com/circlefin/stablecoin-evm/blob/master/doc/tokendesign.md)
- [Solana CCTP Contracts (GitHub)](https://github.com/circlefin/solana-cctp-contracts)
- [Circle CCTP Documentation](https://developers.circle.com/cctp)
- [Circle Quickstart: Transfer USDC on Solana](https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana)

---

### 5.2 PYUSD on Solana (PayPal)

**The reference implementation for Token-2022 stablecoins.** PYUSD is the most technically instructive existing stablecoin for SSS because it uses Token Extensions extensively.

**Mint address:** `2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo`
**Devnet mint:** `CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM`
**Update authority:** `G8ENSYKVGPbRTbcN1BxXuRMYeCq13271UjCUrrpZTJ4X`

**Extensions initialized at mint creation:**

| Extension | Status | Purpose |
|-----------|--------|---------|
| **Permanent Delegate** | Active | Regulatory seizure — unlimited delegate over all accounts for the mint |
| **Transfer Hook** | Initialized (null program ID) | Reserved for future compliance logic; currently no-op |
| **Confidential Transfers** | Initialized (not yet enabled) | Privacy for transaction amounts; pending Solana mainnet support |
| **Transfer Fees** | Initialized (0%) | Fail-safe for future merchant-level fee logic |
| **Metadata + Metadata Pointer** | Active | On-chain name, ticker, image storage |
| **Mint Close Authority** | Active | Can close mint account and reclaim lamports |

**Critical design insight:** Token-2022 extensions must be initialized at mint creation. Extensions cannot be added later. PYUSD initialized all extensions it might ever need, even those not currently active. This is the correct approach for SSS — initialize all potential extensions upfront.

**Transfer hook detail:** The hook is initialized with a null program ID, meaning it's a no-op today. When PayPal deploys a hook program, they can update the hook program ID without recreating the mint. This is the pattern SSS should follow for optional compliance.

**Permanent delegate detail:** Gives unlimited delegate privileges over any account for the mint. Can burn or transfer tokens from anyone's wallet. Critical for law enforcement compliance but dangerous if compromised. This maps directly to SSS-2's `seize` instruction.

**Developer integration:**
```typescript
// Reading PYUSD metadata
const { getTokenMetadata } = require('@solana/spl-token');
const metadata = await getTokenMetadata(connection, mint);

// Transfers use transferChecked with TOKEN_2022_PROGRAM_ID
await transferChecked(connection, payer, source, mint, destination, owner, amount, decimals, [], undefined, TOKEN_2022_PROGRAM_ID);
```

**Sources:**
- [PayPal: Deep Dive into PYUSD Token Extensions](https://developer.paypal.com/community/blog/pyusd-solana-token-extensions/)
- [Solana: Technical Deep Dive into PYUSD](https://solana.com/news/pyusd-paypal-solana-developer)
- [QuickNode: PYUSD Integration Guide](https://blog.quicknode.com/pyusd-solana-integration/)
- [Solana: Token Extensions Overview](https://solana.com/solutions/token-extensions)

---

### 5.3 USDP on Solana (Paxos / Brale)

USDP is the first stablecoin to leverage Solana Token Extensions for compliance controls on a public network.

**Key facts:**
- Launched January 2024 on Solana
- Issued by Paxos Trust Company (NYDFS-regulated)
- Uses Token Extensions including permanent delegate for regulatory compliance
- Integrated with Brale's stablecoin-as-a-service infrastructure

**Brale platform:**
- Institutional-grade stablecoin infrastructure provider on Solana
- Enables businesses to issue and manage fully compliant, reserve-backed stablecoins
- Leverages Token Extensions for compliance controls at the token level
- Supports 1:1 swaps between USDP, USDC, and Brale-issued stablecoins

**Regulatory precedent:** NYDFS-regulated issuers (Paxos, GMO Trust) will use permanent delegate for compliance. This validates SSS-2's permanent delegate approach as the regulatory standard.

**Sources:**
- [Brale: USDP Support](https://brale.xyz/stablecoins/USDP)
- [Paxos: USDP Documentation](https://docs.paxos.com/stablecoin/usdp)
- [Paxos Stablecoin on Solana](https://www.financemagnates.com/cryptocurrency/paxos-diversifies-stablecoin-issuance-with-solana-blockchain-integration/)

---

### 5.4 Open-Source Stablecoin Programs on Solana

#### UXD Protocol (delta-neutral stablecoin)
- [GitHub: uxdprotocol](https://github.com/uxdprotocol)
- **uxd-program** (Rust): Manages minting/redeeming UXD tokens backed by delta-neutral positions on DEXes
- **uxd-client** (TypeScript): JS client for the Solana program
- **uxd-cpi** (Rust): Autogenerated CPI client for cross-program interaction
- Architecture: Collateral-based with hedge positions, uses CPI to interact with DEXes
- Not directly applicable to fiat-backed stablecoins but demonstrates multi-program composition

#### Coin98 Dollar (CUSD)
- [GitHub: coin98/coin98-dollar-mint-burn-sol](https://github.com/coin98/coin98-dollar-mint-burn-sol)
- Anchor-based, Rust (55.6%) + TypeScript (44.4%)
- Collateral-based: users deposit collateral to receive CUSD, redeem CUSD for stablecoins/tokens
- Uses Chainlink oracles for price feeds (requires custom oracle for local testing)
- Licensed Apache-2.0

#### Stablecoin Contract (educational)
- [GitHub: YadlaMani/stablecoin-contract](https://github.com/YadlaMani/stablecoin-contract)
- Solana program with Anchor + TypeScript test suite
- Initializes protocol config and mints stablecoin
- Simpler reference for basic mint/burn patterns

#### SPL Token Mint Platform
- [GitHub: Web3ProdigyDev/SPL-Token-Mint](https://github.com/Web3ProdigyDev/SPL-Token-Mint)
- Anchor + Rust: mint creation, minting, transferring, burning, authority management
- Good reference for SPL token lifecycle operations

**Gap analysis:** No existing open-source project provides a comprehensive, production-grade stablecoin SDK with RBAC, compliance modules, and backend services. SSS fills this gap.

---

### 5.5 Blacklisting / Freezing Mechanisms on Solana

#### Approach 1: Freeze Authority (Legacy SPL Token — used by USDC)
- Freeze authority is set at mint creation
- Can freeze/thaw individual token accounts
- Frozen accounts cannot send, receive, or close
- Effectively acts as blacklist — freeze = blocked
- Only the designated freeze authority can freeze/thaw
- Best practice: control freeze authority with a multisig (Squads)
- Limitation: no programmatic check during transfers — only prevents actions on frozen accounts

#### Approach 2: Transfer Hook (Token-2022 — SSS-2 approach)
- Custom program invoked on every `transferChecked` call
- Can check sender AND recipient against an on-chain blacklist
- Rejects transfer if either party is blacklisted
- More granular than freeze — can implement allowlists, conditional transfers, KYC verification
- Additional compute cost per transfer (CPI overhead)
- Accounts in hook context are read-only

#### Approach 3: Default Account State = Frozen (Token-2022 — allowlist pattern)
- All new token accounts created frozen by default
- Freeze authority must explicitly thaw (whitelist) accounts before they can transact
- Implements KYC/AML allowlisting at the token level
- Used for regulated securities and could complement SSS-2
- Cannot mint to a frozen account — must thaw first

#### Approach 4: Permanent Delegate (Token-2022 — seizure)
- Irrevocable delegate over all accounts for the mint
- Can transfer or burn tokens from any account at will
- Used for law enforcement seizure orders
- Complement to freeze authority — freeze blocks, permanent delegate seizes

**SSS-2 uses a combination:** Transfer hook (Approach 2) for blacklist enforcement on transfers + freeze authority (Approach 1) for account-level blocking + permanent delegate (Approach 4) for seizure. Default frozen state (Approach 3) is optional via `default_account_frozen` config flag.

**Sources:**
- [Solana: Freeze Account](https://solana.com/docs/tokens/basics/freeze-account)
- [Helius: Mint, Freeze, and Update Authority](https://www.helius.dev/docs/orb/explore-authorities)
- [Solana: Default Account State Extension](https://solana.com/developers/guides/token-extensions/default-account-state)
- [Solana: Permanent Delegate](https://solana.com/docs/tokens/extensions/permanent-delegate)
- [Neodyme: Token-2022 Extension Security](https://neodyme.io/en/blog/token-2022/)

---

### 5.6 Stablecoin Design Patterns

#### Pause Mechanism
Circle's EVM implementation is the reference:
- `pause()` / `unpause()` controlled by Pauser role
- When paused: all transfers, minting, burning, and minter additions blocked
- Administrative functions (role changes, authority transfers) remain active during pause
- On Solana, implemented as a `paused: bool` flag in the config PDA, checked by every instruction

SSS implementation: The `StablecoinConfig` account stores `paused` state. Every instruction handler checks `require!(!config.paused, ErrorCode::Paused)` except role management and unpause.

#### Mint Quotas (Per-Minter Allowance)
Circle's `minterAllowance` pattern:
- Each minter has an individual allowance (maximum they can mint)
- Allowance decrements on each mint operation
- MasterMinter periodically resets/adjusts allowances
- Burn does NOT restore allowance — prevents mint-burn-mint amplification
- Limits blast radius if a single minter key is compromised

SSS implementation: `MinterConfig` PDA per minter address stores `quota_remaining: u64` and `quota_total: u64`. `update_minter` resets or adjusts quota.

#### Multi-Sig Authority (Squads Protocol v4)
- [GitHub: Squads-Protocol/v4](https://github.com/Squads-Protocol/v4)
- Program: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`
- Formally verified (OtterSec, Neodyme, Certora, Trail of Bits)
- Immutable since November 2024
- Secures $10B+ in value, $3B+ in stablecoin transfers
- Features: threshold-based execution, role-based access, time locks, spending limits, sub-accounts
- Token authority management: mint, burn, freeze, metadata authorities can be controlled by multisig
- SDK: `@sqds/multisig` (TypeScript) and `squads-multisig` (Rust crate)

SSS integration point: The Master Authority should be a Squads multisig in production. Document this as a recommended deployment pattern. SSS does not need to implement multisig — it delegates to Squads via standard Solana signer mechanics (the multisig PDA signs transactions after threshold approval).

**Sources:**
- [Circle EVM Token Design](https://github.com/circlefin/stablecoin-evm/blob/master/doc/tokendesign.md)
- [Squads Protocol v4 (GitHub)](https://github.com/Squads-Protocol/v4)
- [Squads Multisig](https://squads.xyz/multisig)
- [Squads Documentation](https://docs.squads.so/main)

---

### 5.7 Regional Stablecoins on Solana

Brazilian real stablecoins are the primary regional examples, relevant given this is a Superteam Brazil bounty:

| Stablecoin | Issuer | Chain | Notes |
|------------|--------|-------|-------|
| **BRZ** | Transfero | Ethereum (primary) | Largest non-dollar stablecoin; ERC-20 |
| **BBRL** | Braza Bank | Multiple | 1:1 peg to BRL; combines traditional currency with blockchain |
| **BRL1** | BRL1 | Multiple | Digital asset pegged to Real for domestic and global payments |
| **BRLC** | BRL Coin (2019) | Ethereum | Early Brazilian stablecoin |
| **DREX** | Central Bank of Brazil | Permissioned | CBDC pilot; not public chain |

**Key observation:** No major Brazilian real stablecoin has launched natively on Solana with Token-2022 extensions. SSS could be the framework that enables this — particularly relevant for the Superteam Brazil context. The SSS-2 compliance preset with oracle integration (bonus feature) would enable non-USD pegs.

**Sources:**
- [BRZ Token](https://transfero.com/stablecoins/brz/)
- [BBRL](https://www.brazabank.com.br/en/bbrl/en/)
- [BRL1](https://brl1.io/en/)

---

### 5.8 Architecture Comparison: Single Program vs Multi-Program

#### Single Program (monolithic)
- All instructions in one program (mint, burn, freeze, blacklist, seize, pause, etc.)
- Simpler deployment and testing
- Shared state access without CPI overhead
- Account size limits apply (10MB per account, but stablecoin state is small)
- Example: Most SPL Token operations

#### Multi-Program (modular)
- Separate programs for distinct concerns (e.g., token operations vs. compliance hooks)
- Composable via CPI (max depth: 4 levels beyond initial transaction)
- Independent upgrade cycles per program
- Higher compute cost per operation (CPI overhead)
- Example: PYUSD (token mint + future transfer hook program), Circle CCTP (MessageTransmitter + TokenMessengerMinter)

#### SSS Architecture Decision
SSS uses a **hybrid approach**:
- **Main program (sss-token):** Single program handling all core operations + compliance instructions
- **Transfer hook program:** Separate program required by Token-2022 architecture — invoked via CPI by the Token Extensions program on every transfer

This is the correct choice because:
1. Token-2022 mandates the transfer hook be a separate program
2. The main program benefits from shared state (config, roles, blacklist) without CPI
3. The hook program is stateless — it reads blacklist state from the main program's PDAs
4. Two programs is the minimum viable count; adding more increases deployment/testing complexity without proportional benefit

**CPI constraints:**
- Stack height limit: 5 total (initial tx = 1, each CPI adds 1, max CPI depth = 4)
- `invoke` for standard calls, `invoke_signed` when PDA must sign
- Account permissions (signer, writable) propagate through CPI chain
- Always validate PDA derivation before invoking

**Sources:**
- [Solana: Cross Program Invocation](https://solana.com/docs/core/cpi)
- [Solana: Program Architecture](https://solana.com/developers/courses/program-optimization/program-architecture)
- [Helius: Solana Programming Model](https://www.helius.dev/blog/the-solana-programming-model-an-introduction-to-developing-on-solana)

---

### 5.9 Backend Service Patterns for Stablecoin Operations

#### Event Listening / Indexing Approaches

| Method | Latency | Reliability | Complexity | Cost |
|--------|---------|-------------|------------|------|
| **Geyser gRPC (Yellowstone)** | <50ms | Highest | High (requires dedicated node or provider) | High |
| **Webhooks (Helius/QuickNode)** | ~1-5s | High | Low (HTTP endpoints) | Medium |
| **WebSocket subscriptions** | ~400ms | Brittle in practice | Medium | Low |
| **RPC polling** | Variable | Lowest | Lowest | Highest (rate limits) |

**Recommended for SSS:** Webhooks as the primary approach (simplest, most cost-efficient, handles 100K+ addresses per webhook). Geyser gRPC as an advanced option for high-throughput deployments.

#### Yellowstone gRPC (Geyser Plugin)
- [GitHub: helius-labs/yellowstone-grpc](https://github.com/helius-labs/yellowstone-grpc)
- Components: geyser plugin, proto definitions, Rust client, Node.js client
- Filters: account by pubkey/owner, transaction by status/signature/account involvement, commitment levels
- Streams: slots, blocks, account changes, transactions
- Requires keepalive pings to prevent load balancer timeouts
- Example clients in Go, Rust, TypeScript

#### Helius Webhooks
- Up to 100,000 addresses per webhook
- 70+ parsed transaction types
- Configurable event types with built-in parsing
- Elastic scaling
- Retry logic built-in

#### Reference Indexer Architecture
Based on [sol-indexer](https://github.com/Jayant818/sol-indexer):
- **Hexagonal architecture:** Domain (events) -> Application (pipeline) -> Adapters (inbound/outbound/parsers) -> Infrastructure
- **Pipeline:** Ingest (gRPC/file/RPC) -> Parse (decode + filter) -> Buffer (in-memory + DLQ) -> Persist (PostgreSQL) + Notify
- **Stack:** Rust + tokio + sqlx + PostgreSQL
- **Docker Compose** for infrastructure (PostgreSQL as primary store)
- Dead Letter Queue for malformed events without halting pipeline

#### SSS Backend Service Design

**Mint/Burn Coordination Service:**
```
API request -> verify authorization -> check quota -> execute on-chain tx -> confirm -> log audit event
```
- Queue-based processing for reliability
- Idempotency keys to prevent double-mint
- Transaction confirmation polling with timeout

**Event Listener / Indexer:**
- Subscribe to program events via webhooks or gRPC
- Parse Anchor events (mint, burn, freeze, thaw, pause, blacklist, seize, role changes)
- Persist to PostgreSQL for querying
- Trigger webhook notifications to registered endpoints

**Compliance Service (SSS-2):**
- CRUD for blacklist management
- Integration point for external sanctions screening (OFAC SDN list)
- Transaction monitoring and flagging
- Full audit trail: timestamp, operator, action, target, reason

**Sources:**
- [Helius: Solana Data Streaming](https://www.helius.dev/blog/solana-data-streaming)
- [Helius: Webhooks Documentation](https://www.helius.dev/docs/webhooks)
- [Helius: Geyser Plugins](https://www.helius.dev/blog/solana-geyser-plugins-streaming-data-at-the-speed-of-light)
- [Yellowstone gRPC (GitHub)](https://github.com/helius-labs/yellowstone-grpc)
- [Sol Indexer (GitHub)](https://github.com/Jayant818/sol-indexer)
- [QuickNode: Yellowstone Geyser gRPC Guide](https://www.quicknode.com/guides/solana-development/tooling/geyser/yellowstone)

---

### 5.10 Docker Containerization Patterns for Solana Backend Services

#### Development Environment

**solana-test-validator Docker:**
- [GitHub: tchambard/solana-test-validator-docker](https://github.com/tchambard/solana-test-validator-docker)
- [Docker Hub: tchambard/solana-test-validator](https://hub.docker.com/r/tchambard/solana-test-validator)
- Contains: Rust, Cargo, Anchor, Node.js, Yarn
- Persistent volume (`solana-docker`) for build caches
- Run tests: `docker exec -w /working-dir -ti solana-test-validator sh -c "anchor test --skip-local-validator"`

**Anchor verifiable builds:**
- Circle CCTP uses `backpackapp/build:v0.28.0` for reproducible Anchor builds
- Verifiable on-chain by comparing bytecode hash

#### Production Backend Services

**Do NOT containerize Solana validators for production** — Docker overhead causes performance degradation. Validators/RPC nodes should run on bare metal or dedicated VMs.

**DO containerize:** Backend services (indexer, webhook, compliance, mint-burn coordination)

**Recommended Docker Compose topology for SSS:**
```yaml
services:
  postgres:        # Event store, audit log, blacklist persistence
  redis:           # Job queue, caching, rate limiting
  indexer:         # Listens to on-chain events, writes to postgres
  mint-burn:       # Coordinates mint/burn with on-chain program
  compliance:      # Blacklist management, sanctions screening (SSS-2)
  webhook:         # Event delivery to external endpoints (SSS-2)
```

**Per-service requirements:**
- Health check endpoint (`/health` or `/healthz`)
- Environment-based configuration (`.env` files, no hardcoded secrets)
- Structured JSON logging (timestamp, level, service, message, context)
- Graceful shutdown handling (SIGTERM)
- Resource limits in Docker Compose (`mem_limit`, `cpus`)

**Hybrid pattern (CryptoManufaktur-io/solana-rpc):**
- Solana RPC node runs in systemd (bare metal performance)
- Traefik reverse proxy runs in Docker
- Backend services containerized
- Single `docker-compose.yml` orchestrates non-validator infrastructure

**Sources:**
- [Solana Test Validator Docker](https://github.com/tchambard/solana-test-validator-docker)
- [Run Solana with Docker](https://medium.com/rahasak/deploy-solana-test-network-with-docker-418622c4f566)
- [CryptoManufaktur Solana RPC Docker](https://github.com/CryptoManufaktur-io/solana-rpc)
- [Solana Validator Requirements](https://docs.anza.xyz/operations/requirements)

---

## 6. Anchor 0.31+ — Best Practices & Pitfalls

### 6.1 Breaking Changes (0.30 → 0.31)

| Change | Impact | Migration |
|--------|--------|-----------|
| Discriminator API redesigned | `DISCRIMINATOR` const replaced `discriminator()` method | Use `MyAccount::DISCRIMINATOR` |
| `solana-program` removed as direct dep | Re-exported through `anchor-lang` | Use `anchor_lang::solana_program::*` |
| IDL format changed | New IDL spec, `idl-build` feature required | Add `idl-build` feature, regenerate IDLs |
| Agave transition | `solana-sdk` → `agave-*` crates for validator | Only affects validator-side code |
| `init_if_needed` behavior | Still dangerous — can reinitialize accounts if discriminator check fails | Use explicit `init` + separate `load` paths |

### 6.2 New Features

- **Custom discriminators**: `#[account(discriminator = MY_DISC)]` — useful for CPI compatibility
- **`LazyAccount`**: Defers deserialization, saves CU when you only need a few fields
- **`#[interface]` macro (0.30+)**: Generates SPL-compatible instruction handlers — **use this for transfer hooks** instead of manual fallback handler
- **`token_interface`** in `anchor-spl`: Dual Token/Token-2022 compatibility without branching

### 6.3 Known Bugs

| Version | Bug | Workaround |
|---------|-----|------------|
| 0.30.0 | IDL generation fails with certain generic types | Pin to 0.30.1+ |
| 0.30-0.31 | `declare_program!` macro issues with some account types | Use `declare_id!` + manual CPI |
| 0.31.x | `init_if_needed` with Token-2022 extension accounts may not check extensions | Always validate extension state post-init |
| 0.32.0 | Breaking IDL changes from 0.31 — not backward compatible | Stay on 0.31.1 for SSS |

### 6.4 Security Vulnerabilities (Ranked by Frequency)

1. **Missing signer checks** — #1 exploit cause across Solana programs
   ```rust
   // BAD: anyone can call
   pub fn admin_action(ctx: Context<AdminAction>) -> Result<()> { ... }

   // GOOD: Anchor's has_one + Signer constraint
   #[derive(Accounts)]
   pub struct AdminAction<'info> {
       #[account(has_one = authority)]
       pub config: Account<'info, Config>,
       pub authority: Signer<'info>,
   }
   ```

2. **Missing owner checks** — accounts from wrong program pass validation
   ```rust
   // Anchor's Account<> type checks owner automatically
   // For raw AccountInfo, always verify: account.owner == expected_program_id
   ```

3. **Stale data after CPI** — account data may change during CPI but local reference is stale
   ```rust
   // After CPI that modifies an account:
   ctx.accounts.token_account.reload()?;
   ```

4. **`init_if_needed` reinitialization** — attacker closes account, calls again to reinitialize with attacker-controlled data
   - Mitigation: Use `init` for creation, separate instruction for loading
   - If `init_if_needed` is required: add explicit `is_initialized` flag check

5. **Integer overflow** — Rust wraps in release mode
   - `overflow-checks = true` in Cargo.toml release profile (already in our config)
   - Use `checked_*` operations for any user-supplied arithmetic

6. **`remaining_accounts` has zero validation** — Anchor provides no type/owner/signer checks
   ```rust
   // Always validate remaining_accounts manually:
   for account in ctx.remaining_accounts {
       require!(account.owner == &expected_program, ErrorCode::InvalidOwner);
   }
   ```

7. **Account confusion / cosplay** — accounts from different programs with same structure
   - Anchor's discriminator prevents this for Anchor-to-Anchor
   - Cross-program: explicitly verify `account.owner` and discriminator bytes

### 6.5 Token-2022 Integration Patterns

**Dual-compatibility accounts (Token + Token-2022):**
```rust
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        mint::authority = authority,
        extensions::permanent_delegate::delegate = config.key(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}
```

**Extension constraints** (Anchor 0.31+):
```rust
// Verify permanent delegate is set correctly
#[account(
    extensions::permanent_delegate::delegate = config.key(),
)]
pub mint: InterfaceAccount<'info, Mint>,

// Verify transfer hook program
#[account(
    extensions::transfer_hook::program_id = hook_program.key(),
)]
pub mint: InterfaceAccount<'info, Mint>,
```

### 6.6 PDA Patterns

**Correct pattern — pass bump via context:**
```rust
#[account(
    seeds = [b"config", authority.key().as_ref()],
    bump = config.bump,  // stored bump, saves CU vs re-derivation
)]
pub config: Account<'info, StablecoinConfig>,
```

**Anti-pattern — don't re-derive when stored:**
```rust
// WASTEFUL: re-derives bump every call (~thousands of CU)
#[account(
    seeds = [b"config", authority.key().as_ref()],
    bump,  // re-derives
)]
```

### 6.7 CPI Pitfalls

1. **Signer privilege persistence**: If Program A CPIs into Program B, and B CPIs into C, C sees A's original signers. Be explicit about which signers should propagate.

2. **PDA-signed CPI**: Use `invoke_signed` with correct seeds. The PDA must derive from the *calling* program's ID.

3. **Stack depth limit**: 5 total (initial tx = 1 + max 4 CPI levels). Transfer hook already consumes 1 CPI level (Token-2022 → hook).

4. **Compute budget**: Transfer hooks run within the caller's CU budget. Budget accordingly (~30k-50k CU for blacklist check).

### 6.8 Recommended Cargo.toml for SSS Transfer Hook (Anchor 0.31)

```toml
[dependencies]
anchor-lang = { version = "0.31.1", features = ["init-if-needed"] }
anchor-spl = { version = "0.31.1", features = ["token", "associated_token", "metadata"] }
spl-token-2022 = "5"
spl-transfer-hook-interface = "0.8"
spl-tlv-account-resolution = "0.7"

[features]
default = []
cpi = ["no-entrypoint"]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```

**Version compatibility warning**: Do NOT use `spl-token-2022 >= 7` or `spl-transfer-hook-interface >= 1.0` — these target Solana SDK v3 which is incompatible with Anchor 0.31.

---

## 7. Transfer Hook — Implementation Deep Dive

### 7.1 Production Implementations

| Project | Pattern | Status |
|---------|---------|--------|
| **Civic Pass** | Identity-based transfer restriction | Production |
| **Solana whitelist example** | Allowlist via extra account meta | Reference |
| **SOL fee transfer hook** | Charges SOL fee on transfer | Reference |
| **Libreplex** | Metadata & royalty enforcement | Production |

### 7.2 Seven Common Pitfalls

1. **Wrong account order** — Token-2022 expects accounts 0-4 in fixed order: `[source, mint, destination, owner, extra_account_metas_pda]`. Extra accounts follow.

2. **Missing `transferring` flag check** — Without this, anyone can invoke your hook directly (not via Token-2022 transfer). Always verify the flag.

3. **Trying to modify accounts** — All accounts in hook context are **read-only**. Cannot write to any account from within the hook. Design state changes as separate instructions.

4. **Forgetting `InitializeExtraAccountMetaList`** — Must be called before any transfer. Create this PDA as part of your `initialize` instruction flow.

5. **Wrong discriminator** — Anchor's 8-byte discriminator differs from SPL Transfer Hook Interface's discriminator. Either:
   - Use `#[interface(spl_transfer_hook_interface::execute)]` (Anchor 0.30+) — **recommended**
   - Or implement manual fallback handler (Section 2.2 above)

6. **ExtraAccountMeta size miscalculation** — Use `ExtraAccountMetaList::size_of(num_extra_accounts)` for exact sizing. Wrong size = account init failure.

7. **Client-side account resolution failure** — `createTransferCheckedWithTransferHookInstruction()` must resolve all extra accounts. Test this with LiteSVM.

### 7.3 ExtraAccountMeta Pattern (Detailed)

Three account types in ExtraAccountMeta:
1. **Direct pubkey**: Static account, known at init time
2. **Program PDA**: Derived from the hook program's ID + literal seeds
3. **External PDA**: Derived from another program's ID + dynamic seeds (e.g., account key as seed)

**For SSS-2 blacklist enforcement:**
```
ExtraAccountMeta[0] = Program PDA: blacklist entry for source
  seeds = ["blacklist", config.key(), source_wallet.key()]

ExtraAccountMeta[1] = Program PDA: blacklist entry for destination
  seeds = ["blacklist", config.key(), destination_wallet.key()]

ExtraAccountMeta[2] = Direct pubkey: stablecoin config PDA
```

The hook checks: if either blacklist PDA exists AND is marked active → reject transfer. If PDA doesn't exist (account not initialized) → address is not blacklisted → allow.

### 7.4 Blacklist Enforcement: PDA-per-Address Pattern

**Recommended over Vec<Pubkey> in a single account** (doesn't scale):
```rust
#[account]
pub struct BlacklistEntry {
    pub config: Pubkey,      // parent config
    pub address: Pubkey,     // blacklisted wallet
    pub reason: String,      // "OFAC match", "court order", etc.
    pub blacklisted_at: i64, // Unix timestamp
    pub blacklisted_by: Pubkey, // operator identity
    pub active: bool,        // soft-delete for audit trail
    pub bump: u8,
    pub _reserved: [u8; 32],
}

impl BlacklistEntry {
    pub const SEED_PREFIX: &'static [u8] = b"blacklist";
    // seeds = ["blacklist", config.key(), address.key()]
}
```

**Hook logic:**
```rust
pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    // 1. Verify transferring flag
    assert_is_transferring(&ctx)?;

    // 2. Check config is not paused
    require!(!ctx.accounts.config.paused, ErrorCode::Paused);

    // 3. Check blacklist entries
    // If blacklist PDA exists and is active → reject
    if let Some(source_bl) = &ctx.accounts.source_blacklist {
        require!(!source_bl.active, ErrorCode::SenderBlacklisted);
    }
    if let Some(dest_bl) = &ctx.accounts.destination_blacklist {
        require!(!dest_bl.active, ErrorCode::RecipientBlacklisted);
    }

    Ok(())
}
```

### 7.5 Performance Implications

| Metric | Without Hook | With Hook (blacklist) |
|--------|-------------|----------------------|
| CU per transfer | ~5k | ~30k-50k |
| Transaction size | Standard | +2-3 accounts (extra metas) |
| Client complexity | Standard | Must resolve extra accounts |

**Mitigation**: Pre-resolve extra accounts client-side and cache them. The SDK should abstract this entirely.

### 7.6 Testing

**LiteSVM** (recommended, bankrun deprecated March 2025):
- In-process Solana runtime for fast tests
- Supports Token-2022 with transfer hooks
- No external validator process needed
- Compatible with Anchor test framework

**Integration test flow:**
1. Initialize mint with transfer hook extension
2. Initialize ExtraAccountMetaList
3. Create token accounts
4. Transfer (should succeed — no blacklist entries)
5. Add address to blacklist
6. Transfer (should fail — sender blacklisted)
7. Remove from blacklist
8. Transfer (should succeed again)

---

## 8. Solana Program Security — Audit Findings & Patterns

### 8.1 Top Vulnerability Categories (163 audits analyzed)

| Rank | Category | Frequency | SSS Relevance |
|------|----------|-----------|---------------|
| 1 | Missing signer/authority checks | Very High | All role-gated instructions |
| 2 | Arithmetic overflow/underflow | High | Quota management, amounts |
| 3 | Missing account owner validation | High | CPI, cross-program accounts |
| 4 | Account confusion / type cosplay | High | Blacklist entries, role PDAs |
| 5 | Stale data after CPI | Medium | Seize (CPI transfer then reload) |
| 6 | PDA seed collision | Medium | Role + blacklist PDAs |
| 7 | Missing rent-exemption checks | Low | Account initialization |

### 8.2 Token-2022 Specific Security

1. **Account sizing** — Use `ExtensionType::try_calculate_account_len()`, not manual size calculation. Wrong size = silent data corruption.

2. **Token program type detection** — Always check `account.owner` to determine Token vs Token-2022:
   ```rust
   if account.owner == &spl_token::id() { /* Token */ }
   else if account.owner == &spl_token_2022::id() { /* Token-2022 */ }
   ```

3. **Instruction selection** — Use `spl_token_2022::instruction::*` for Token-2022 mints. Sending Token program instructions to Token-2022 accounts = failure.

4. **Mint close authority attack** — If mint close authority is set, attacker could close and reinitialize the mint. Either:
   - Don't set mint close authority (safest)
   - If set, verify mint state on every operation

5. **Extension allowlisting** — Token-2022 allows any combination of extensions. Validate that accounts only have expected extensions:
   ```rust
   let extensions = mint_account.get_extension_types()?;
   require!(extensions.contains(&ExtensionType::PermanentDelegate), ErrorCode::MissingExtension);
   ```

### 8.3 RBAC Implementation Pattern

```rust
#[account]
pub struct RoleAssignment {
    pub config: Pubkey,
    pub role_type: RoleType,
    pub address: Pubkey,
    pub assigned_by: Pubkey,
    pub assigned_at: i64,
    pub bump: u8,
    pub _reserved: [u8; 32],
}

// PDA: ["role", config.key(), role_type as u8, address.key()]

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum RoleType {
    Minter = 0,
    Burner = 1,
    Pauser = 2,
    Blacklister = 3,
    Seizer = 4,
}
```

**Validation:**
```rust
#[account(
    seeds = [b"role", config.key().as_ref(), &[RoleType::Minter as u8], authority.key().as_ref()],
    bump = role_assignment.bump,
)]
pub role_assignment: Account<'info, RoleAssignment>,
pub authority: Signer<'info>,
```

### 8.4 Two-Step Authority Transfer

Prevents accidental or malicious authority transfer to wrong address:

```rust
// Step 1: Current authority proposes new authority
pub fn propose_authority_transfer(ctx: Context<ProposeTransfer>, new_authority: Pubkey) -> Result<()> {
    ctx.accounts.config.pending_authority = Some(new_authority);
    Ok(())
}

// Step 2: New authority accepts
pub fn accept_authority_transfer(ctx: Context<AcceptTransfer>) -> Result<()> {
    require!(
        ctx.accounts.config.pending_authority == Some(ctx.accounts.new_authority.key()),
        ErrorCode::UnauthorizedAuthority
    );
    ctx.accounts.config.authority = ctx.accounts.new_authority.key();
    ctx.accounts.config.pending_authority = None;
    Ok(())
}
```

### 8.5 Permanent Delegate Risk Mitigations

The permanent delegate is the most dangerous extension — irrevocable, mint-wide, can drain any account.

| Risk | Mitigation |
|------|------------|
| Key compromise → drain all holders | Delegate should be a Squads multisig (threshold ≥ 3/5) |
| Unauthorized seizure | Separate Seizer role + freeze-before-seize pattern |
| No audit trail for seizures | Emit detailed event: source, dest, amount, reason, authority, timestamp |
| Accidental seizure | Require target account to be frozen first (`require!(account.is_frozen)`) |
| Treasury destination validation | Hardcode or PDA-derive the treasury address |

**Freeze-before-seize pattern:**
```rust
pub fn seize(ctx: Context<Seize>, amount: u64, reason: String) -> Result<()> {
    // 1. Verify target is frozen (prevents accidental seizure of active accounts)
    require!(ctx.accounts.target_token_account.is_frozen(), ErrorCode::AccountNotFrozen);

    // 2. Verify treasury is the designated treasury
    require!(ctx.accounts.treasury == ctx.accounts.config.treasury, ErrorCode::InvalidTreasury);

    // 3. Transfer via permanent delegate (CPI to Token-2022)
    // ... transfer_checked with PDA signer ...

    // 4. Emit audit event
    emit!(SeizeEvent {
        source: ctx.accounts.target_token_account.key(),
        treasury: ctx.accounts.treasury.key(),
        amount,
        reason,
        authority: ctx.accounts.seizer.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

### 8.6 Account Confusion Prevention

The Cashio exploit ($52M loss) was caused by account confusion — verifying the wrong account type. Prevention:

1. **Always use Anchor typed accounts** — `Account<'info, MyType>` checks discriminator + owner
2. **For cross-program accounts**: verify `account.owner == expected_program_id`
3. **For Token-2022 accounts**: verify mint matches expected mint
4. **For PDAs**: always re-derive and compare (Anchor does this with `seeds` constraint)

### 8.7 Trident Fuzz Testing — SSS-Specific Invariants

10 invariants to fuzz-test:

1. **Supply conservation**: `total_supply == sum(all_token_account_balances)` after any operation
2. **Quota monotonicity**: `minter.quota_remaining <= minter.quota_total` always
3. **Pause enforcement**: No transfer/mint/burn succeeds when `config.paused == true`
4. **Blacklist enforcement**: No transfer succeeds when sender or recipient is blacklisted
5. **Role exclusivity**: Only holders of correct role can execute role-gated instructions
6. **Authority immutability**: `config.authority` only changes via `transfer_authority` instruction
7. **Freeze enforcement**: Frozen accounts cannot send or receive tokens
8. **Seize requires freeze**: `seize` fails on non-frozen accounts
9. **Blacklist reason required**: `add_to_blacklist` fails with empty reason
10. **Quota decrement**: After mint of amount X, `quota_remaining` decreases by exactly X

**Trident configuration:**
```toml
[fuzz]
iterations = 10_000
exit_upon_crash = false

[honggfuzz]
timeout = 30
mutations_per_run = 6
```

---

## 9. Token-2022 — Latest Updates & Status (as of Feb 2026)

### 9.1 ZK ElGamal Proof Program Status

- **Disabled** on mainnet and devnet since June 2025 (two vulnerabilities discovered)
- Code4rena audit completed September 2025
- No re-enablement as of February 2026
- **Implication**: SSS-3 (confidential transfers) cannot be deployed to mainnet/devnet. Implement as code-complete with localnet tests only.

### 9.2 New Extensions (since initial research)

| Extension | Status | SSS Relevance |
|-----------|--------|---------------|
| **Pausable** | Available | Could replace our manual `paused` flag in config — but using config flag gives more control |
| **Scaled UI Amount** | Available | Display formatting — not critical |
| **Permissioned Burn** | Available | Not needed — we control burn via RBAC |
| **Group / Member** | Available | Could group multiple stablecoin denominations — bonus feature territory |

**Decision for SSS**: Use the **Pausable** extension as a secondary enforcement layer alongside the config `paused` flag. The config flag controls our program instructions; the Pausable extension controls Token-2022 transfers at the protocol level. Belt-and-suspenders.

### 9.3 Token-2022 Adoption Status

| Token | Status | Extensions Used |
|-------|--------|----------------|
| **PYUSD** | Production | PermanentDelegate, TransferHook (null), ConfidentialTransfers (init only), TransferFees (0%), Metadata, MintCloseAuthority |
| **USYC** | Production | Token-2022 with custody flows |
| **USDG** | Production | Token-2022 |
| **USDP** | Production | PermanentDelegate + compliance controls |
| **USDC** | Production | **NOT on Token-2022** — legacy SPL Token |

### 9.4 Metadata Best Practice

Use **MetadataPointer + embedded TokenMetadata** (not Metaplex):
```rust
// Initialize MetadataPointer to point to the mint itself
initialize_metadata_pointer(
    &TOKEN_2022_PROGRAM_ID,
    &mint_key,
    Some(authority),
    Some(mint_key),  // metadata stored on mint account itself
)?;

// Then initialize the metadata
initialize_token_metadata(
    &TOKEN_2022_PROGRAM_ID,
    &mint_key,
    &update_authority,
    &mint_key,
    &authority,
    name,
    symbol,
    uri,
)?;
```

This is cheaper (no separate Metaplex account), natively supported by Token-2022, and how PYUSD does it.

### 9.5 Compute Unit Costs

| Operation | Approximate CU |
|-----------|---------------|
| Token-2022 transfer (no extensions) | ~5,000 |
| Transfer with hook (blacklist check) | ~30,000-50,000 |
| Mint with metadata | ~20,000 |
| Freeze/thaw | ~8,000 |
| Initialize mint (all extensions) | ~100,000-150,000 |

**Budget accordingly**: Set compute budget to 200k for `initialize`, 100k for transfers with hooks. Default 200k is sufficient for most operations.

### 9.6 SDK Dependency Versions

**For web3.js v1 (recommended for stability):**
```json
{
  "@solana/spl-token": "^0.4.14",
  "@solana/web3.js": "^1.98.0",
  "@coral-xyz/anchor": "^0.31.1"
}
```

**For web3.js v2 (bleeding edge, not recommended for SSS):**
```json
{
  "@solana-program/token-2022": "^0.6.1",
  "@solana/web3.js": "^2.0.0"
}
```

**Decision for SSS**: Use web3.js v1 + `@solana/spl-token ^0.4.14`. The v2 ecosystem is still stabilizing and Anchor 0.31 targets v1.

### 9.7 Repository Migration Note

The `spl-token-2022` crate source has moved from `solana-labs/solana-program-library` to `solana-program/token-2022`. The crates.io package name remains the same. Latest crate version is v10.0.0, but **use v5.x for Anchor 0.31 compatibility**.

---

## 10. References

| Resource | URL |
|----------|-----|
| Bounty listing | https://superteam.fun/earn/listing/build-the-solana-stablecoin-standard-bounty |
| Quality benchmark (Vault Standard) | https://github.com/solanabr/solana-vault-standard |
| Token Extensions overview | https://solana.com/solutions/token-extensions |
| Permanent delegate guide | https://solana.com/developers/guides/token-extensions/permanent-delegate |
| Transfer hook guide | https://solana.com/developers/guides/token-extensions/transfer-hook |
| Confidential transfers | https://solana.com/docs/tokens/extensions/confidential-transfer |
| Default account state | https://solana.com/developers/guides/token-extensions/default-account-state |
| GENIUS Act compliance guide | https://www.steptoe.com/en/news-publications/blockchain-blog/the-genius-act-and-financial-crimes-compliance-a-detailed-guide.html |
| Anchor framework | https://www.anchor-lang.com/ |
| Solana Cookbook | https://solana.com/developers/cookbook |
| Circle USDC on Solana | https://www.circle.com/multi-chain-usdc/solana |
| Circle EVM stablecoin (GitHub) | https://github.com/circlefin/stablecoin-evm |
| Circle EVM token design doc | https://github.com/circlefin/stablecoin-evm/blob/master/doc/tokendesign.md |
| Circle CCTP Solana contracts (GitHub) | https://github.com/circlefin/solana-cctp-contracts |
| Circle CCTP documentation | https://developers.circle.com/cctp |
| PayPal PYUSD Token Extensions deep dive | https://developer.paypal.com/community/blog/pyusd-solana-token-extensions/ |
| PYUSD technical deep dive (Solana) | https://solana.com/news/pyusd-paypal-solana-developer |
| PYUSD QuickNode integration guide | https://blog.quicknode.com/pyusd-solana-integration/ |
| Paxos USDP documentation | https://docs.paxos.com/stablecoin/usdp |
| Brale stablecoin infrastructure | https://brale.xyz/stablecoins/USDP |
| UXD Protocol (GitHub) | https://github.com/uxdprotocol |
| Coin98 Dollar mint/burn (GitHub) | https://github.com/coin98/coin98-dollar-mint-burn-sol |
| Squads Protocol v4 (GitHub) | https://github.com/Squads-Protocol/v4 |
| Squads Multisig documentation | https://docs.squads.so/main |
| Yellowstone gRPC (GitHub) | https://github.com/helius-labs/yellowstone-grpc |
| Helius data streaming guide | https://www.helius.dev/blog/solana-data-streaming |
| Helius webhooks documentation | https://www.helius.dev/docs/webhooks |
| Helius Geyser plugins guide | https://www.helius.dev/blog/solana-geyser-plugins-streaming-data-at-the-speed-of-light |
| Sol indexer reference (GitHub) | https://github.com/Jayant818/sol-indexer |
| Solana test validator Docker (GitHub) | https://github.com/tchambard/solana-test-validator-docker |
| CryptoManufaktur Solana RPC Docker (GitHub) | https://github.com/CryptoManufaktur-io/solana-rpc |
| Solana CPI documentation | https://solana.com/docs/core/cpi |
| Solana freeze account docs | https://solana.com/docs/tokens/basics/freeze-account |
| Neodyme Token-2022 security analysis | https://neodyme.io/en/blog/token-2022/ |
| RareSkills Token-2022 specification | https://rareskills.io/post/token-2022 |
| Token-2022 primer (Yash Agarwal) | https://yashhsm.medium.com/primer-on-solanas-token-extensions-ef8fbd717c56 |
| BRZ Token (Transfero) | https://transfero.com/stablecoins/brz/ |
| Solana program architecture course | https://solana.com/developers/courses/program-optimization/program-architecture |
| Anchor changelog / releases | https://github.com/coral-xyz/anchor/releases |
| Anchor Book | https://www.anchor-lang.com/docs |
| spl-transfer-hook-interface (crates.io) | https://crates.io/crates/spl-transfer-hook-interface |
| spl-tlv-account-resolution (crates.io) | https://crates.io/crates/spl-tlv-account-resolution |
| Civic Pass transfer hook | https://github.com/nicholasgasior/civic-pass-transfer-hook |
| Solana whitelist transfer hook example | https://github.com/solana-developers/program-examples/tree/main/tokens/transfer-hook |
| LiteSVM testing framework | https://github.com/LiteSVM/litesvm |
| Trident fuzz testing | https://github.com/Ackee-Blockchain/trident |
| Cashio exploit post-mortem | https://blog.cashio.app/cashio-post-mortem/ |
| Token-2022 crate (crates.io) | https://crates.io/crates/spl-token-2022 |
| solana-program/token-2022 repo | https://github.com/solana-program/token-2022 |
| ZK ElGamal Code4rena audit | https://code4rena.com/audits/2025-solana-zk-elgamal |
| Solana Token Extensions guide | https://solana.com/developers/guides/token-extensions/getting-started |
