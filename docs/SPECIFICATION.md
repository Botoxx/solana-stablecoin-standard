# Solana Stablecoin Standard (SSS) — Specification

**Bounty:** Superteam Brazil
**Prize Pool:** $5,000 USDC (1st: $2,500 · 2nd: $1,500 · 3rd: $1,000)
**Repository:** `github.com/solanabr/solana-stablecoin-standard`
**Required Skills:** Rust, Anchor, TypeScript, Token-2022 Extensions, Backend Development
**Eligibility:** Global · KYC required for winners
**Timeline:** 21 days submission · 10 days review · 14 days to announce winners

---

## 1. Overview

An open-source SDK and standardized presets for stablecoins on Solana, modeled after the Vault Standard. The system provides a configurable on-chain program, composable modules, opinionated presets, a TypeScript SDK, an admin CLI, and backend services — all production-grade and Docker-containerized.

---

## 2. Architecture — 3-Layer Model

### Layer 1 — Base SDK

Core token creation infrastructure:

- Token creation with mint/freeze authorities
- Metadata management (Token-2022 metadata extension)
- Role-based access controls
- CLI and TypeScript toolkit

### Layer 2 — Modules

Composable, opt-in features:

| Category | Features |
|----------|----------|
| **Compliance** | Transfer hooks, blacklists, permanent delegate |
| **Privacy** | Confidential transfers, allowlists |

### Layer 3 — Standard Presets

Two opinionated configurations built from Layer 1 + Layer 2:

| Preset | Purpose | Features |
|--------|---------|----------|
| **SSS-1 (Minimal)** | Internal tokens, DAOs | Basic mint/burn/freeze/pause controls |
| **SSS-2 (Compliant)** | Regulatory-grade stablecoins | SSS-1 + blacklist enforcement, seizure via permanent delegate, transfer hook verification |

---

## 3. On-Chain Program (Anchor)

A single configurable Anchor program supporting both presets.

### 3.1 Configuration Account

```rust
pub struct StablecoinConfig {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
}
```

### 3.2 Instructions

#### Core Instructions (All Presets)

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create token with config parameters, set up Token-2022 mint with selected extensions |
| `mint` | Issue new tokens to a recipient (minter role required) |
| `burn` | Destroy tokens (burner role required) |
| `freeze_account` | Disable transfers for a specific token account |
| `thaw_account` | Re-enable transfers for a frozen token account |
| `pause` | Halt all token transfers globally (pauser role required) |
| `unpause` | Resume global transfers (pauser role required) |
| `update_minter` | Modify minter permissions and quotas |
| `update_roles` | Assign or revoke roles for addresses |
| `transfer_authority` | Hand off master authority to a new address |

#### SSS-2 Compliance Instructions

| Instruction | Description |
|-------------|-------------|
| `add_to_blacklist` | Block an address from sending/receiving (blacklister role required) |
| `remove_from_blacklist` | Unblock a previously blacklisted address |
| `seize` | Confiscate tokens from a frozen account via permanent delegate (seizer role required) |

### 3.3 Transfer Hook Program (SSS-2)

A separate on-chain program that enforces blacklist verification on every transfer:

- Registered as the transfer hook during `initialize` when `enable_transfer_hook = true`
- Checks sender and recipient against the on-chain blacklist
- Fails the transfer if either party is blacklisted
- Instructions fail gracefully (no-op) if compliance was not enabled at initialization

---

## 4. Role-Based Access Control

Five distinct roles to prevent single-key dominance:

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Master Authority** | All presets | Full control, role assignment, authority transfer |
| **Minter** | All presets | Token issuance (with per-minter quotas) |
| **Burner** | All presets | Token destruction |
| **Pauser** | All presets | Global pause/unpause |
| **Blacklister** | SSS-2 only | Add/remove addresses from blacklist |
| **Seizer** | SSS-2 only | Confiscate tokens from frozen accounts to treasury |

- Multiple addresses can hold the same role
- Per-minter quotas limit issuance amounts
- Role changes require master authority signature

---

## 5. TypeScript SDK (`@stbr/sss-token`)

### 5.1 Initialization

#### Preset-Based

```typescript
const stable = await SolanaStablecoin.create(connection, {
    preset: Presets.SSS_2,
    name: "My Stablecoin",
    symbol: "MYUSD",
    decimals: 6,
    authority: adminKeypair,
});
```

#### Custom Configuration

```typescript
const custom = await SolanaStablecoin.create(connection, {
    name: "Custom Stable",
    symbol: "CUSD",
    extensions: {
        permanentDelegate: true,
        transferHook: false,
    },
});
```

### 5.2 Operations API

```typescript
// Minting
await stable.mint({ recipient, amount, minter });

// Burning
await stable.burn({ amount, burner });

// Freeze / Thaw
await stable.freezeAccount(address);
await stable.thawAccount(address);

// Pause / Unpause
await stable.pause();
await stable.unpause();

// Compliance (SSS-2)
await stable.compliance.blacklistAdd(address, reason);
await stable.compliance.blacklistRemove(address);
await stable.compliance.seize(frozenAccount, treasury);

// Queries
const supply = await stable.getTotalSupply();
```

---

## 6. Admin CLI (`sss-token`)

### 6.1 Initialization

```bash
sss-token init --preset sss-1
sss-token init --preset sss-2
sss-token init --custom config.toml
```

### 6.2 Token Operations

```bash
sss-token mint <recipient> <amount>
sss-token burn <amount>
sss-token freeze <address>
sss-token thaw <address>
sss-token pause
sss-token unpause
sss-token status
sss-token supply
```

### 6.3 Compliance (SSS-2)

```bash
sss-token blacklist add <address> --reason "OFAC match"
sss-token blacklist remove <address>
sss-token seize <address> --to <treasury>
```

### 6.4 Management

```bash
sss-token minters list
sss-token minters add <address> --quota <amount>
sss-token minters remove <address>
sss-token holders [--min-balance <amount>]
sss-token audit-log [--action <type>]
```

---

## 7. Backend Services

All services must be Rust or TypeScript, Docker-containerized, with environment-based configuration, structured logging, and health check endpoints.

### 7.1 Core Services (All Presets)

#### Mint/Burn Coordination Service

Fiat lifecycle coordination with the following flow:

```
request → verify → execute on-chain → log
```

- Handles mint and burn request queuing
- Verification step for off-chain authorization
- On-chain execution with transaction confirmation
- Audit logging of all operations

#### Event Listener / Indexer

- Monitors on-chain events for the stablecoin program
- Indexes mint, burn, freeze, thaw, pause, and role change events
- Triggers webhook notifications on configurable events

### 7.2 SSS-2 Additional Services

#### Compliance Service

- Blacklist management with CRUD operations
- Integration point for sanctions screening (OFAC, etc.)
- Transaction monitoring and flagging
- Full audit trail with timestamps and operator identity

#### Webhook Service

- Configurable event subscriptions
- Retry logic with exponential backoff
- Event payload delivery to registered endpoints

### 7.3 Deployment

- Docker Compose setup for all services
- Environment-based configuration (`.env`)
- Health check endpoints per service
- Structured JSON logging

---

## 8. Testing Requirements

| Category | Scope |
|----------|-------|
| **Unit tests** | All on-chain instructions, SDK methods, CLI commands |
| **Integration tests** | Full flows per preset (e.g., mint → transfer → freeze → seize) |
| **Fuzz testing** | Via Trident framework against the Anchor program |
| **Configuration tests** | Verify preset configs produce correct extension combinations |
| **Devnet stress testing** | Deployment proof with program IDs and example transactions |

---

## 9. Documentation Deliverables

| Document | Content |
|----------|---------|
| `README.md` | Project overview, quick start, setup instructions |
| `ARCHITECTURE.md` | System design, 3-layer model, account layouts, data flow |
| `SDK.md` | TypeScript SDK reference with all methods and types |
| `OPERATIONS.md` | Operator runbook for CLI and backend services |
| `SSS-1.md` | Minimal preset specification |
| `SSS-2.md` | Compliant preset specification |
| `COMPLIANCE.md` | Regulatory considerations, blacklist design, seizure flow |
| `API.md` | Backend service API endpoints and webhook payload formats |

---

## 10. Submission Requirements

- Pull request to `github.com/solanabr/solana-stablecoin-standard`
- Complete source code with all tests passing
- Devnet deployment proof with program IDs
- Full documentation suite (Section 9)
- Docker Compose setup for backend services

---

## 11. Evaluation Criteria

| Criterion | Weight |
|-----------|--------|
| SDK design & modularity | 20% |
| Completeness | 20% |
| Code quality | 20% |
| Developer credentials | 20% |
| Security | 15% |
| Usability & documentation | 5% |
| **Bonus features** | **up to +50%** |

---

## 12. Bonus Features

| Feature | Description |
|---------|-------------|
| **SSS-3 Private Stablecoin** | Confidential transfers via Token-2022 confidential transfer extension |
| **Oracle Integration Module** | Support non-USD pegs via oracle price feeds |
| **Interactive Terminal UI** | Real-time monitoring dashboard in the terminal |
| **Example Frontend App** | Web application demonstrating SDK usage |
