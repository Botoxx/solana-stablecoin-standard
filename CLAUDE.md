# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Solana Stablecoin Standard (SSS) — an open-source SDK and standardized presets for stablecoins on Solana, modeled after the [Vault Standard](https://github.com/solanabr/solana-vault-standard) (quality benchmark). Superteam Brazil bounty ($5,000 USDC). Full specification: `docs/SPECIFICATION.md`.

**Current state:** Specification-only. All code to be implemented.

## Architecture — 3-Layer Model

- **Layer 1 (Base SDK):** Token creation with mint/freeze authorities, Token-2022 metadata extension, RBAC, CLI + TypeScript toolkit
- **Layer 2 (Modules):** Composable opt-in features — compliance (transfer hooks, blacklists, permanent delegate), privacy (confidential transfers, allowlists)
- **Layer 3 (Presets):**
  - **SSS-1 (Minimal):** Basic mint/burn/freeze/pause — for internal tokens, DAOs
  - **SSS-2 (Compliant):** SSS-1 + blacklist enforcement, seizure via permanent delegate, transfer hook verification — regulatory-grade

## Key Technical Decisions

- **Single Anchor program** supports both presets via `StablecoinConfig` flags (`enable_permanent_delegate`, `enable_transfer_hook`, `default_account_frozen`)
- **Separate Transfer Hook program** (SSS-2) registered during `initialize` — checks sender/recipient against on-chain blacklist on every transfer
- **Token-2022 extensions** are the foundation (not legacy SPL Token)
- **6 RBAC roles:** Master Authority, Minter (with per-minter quotas), Burner, Pauser, Blacklister (SSS-2), Seizer (SSS-2)
- SSS-2 compliance instructions fail gracefully (no-op) if compliance was not enabled at initialization
- **Permanent delegate** enables token seizure — irrevocable, mint-wide authority over all token accounts. Only the current delegate can reassign.
- **Transfer hook**: Use `#[interface(spl_transfer_hook_interface::execute)]` (Anchor 0.30+) instead of manual fallback handler. Must verify `transferring` flag to prevent direct invocation attacks. Extra account metas stored in PDA: `["extra-account-metas", mint]`.
- **Blacklist**: PDA-per-address pattern (`["blacklist", config, address]`), not Vec in single account
- **Metadata**: MetadataPointer + embedded TokenMetadata (not Metaplex) — cheaper, native Token-2022
- **Authority transfer**: Two-step (propose → accept) to prevent accidental loss
- **Seize pattern**: Freeze-before-seize (target must be frozen before seizure)
- **PYUSD pattern**: Pre-initialize all extensions at mint creation (can't add later)

## Token-2022 Extension Constraints

- Transfer hooks and confidential transfers **do not currently work together** (fix pending)
- ZK ElGamal Proof Program **disabled** since June 2025 (two vulnerabilities). Code4rena audit done Sep 2025, no re-enablement as of Feb 2026. SSS-3 = localnet-only.
- Permanent delegate cannot be revoked by token account owners — single point of failure if key compromised
- Transfer hook accounts are **read-only** — sender signer privileges don't extend to hook program
- Extensions must be initialized at mint creation — cannot add later

## Pinned Dependencies (Anchor 0.31 Compatibility)

**Rust (Cargo.toml):**
```toml
anchor-lang = "0.31.1"
anchor-spl = { version = "0.31.1", features = ["token", "associated_token", "metadata"] }
spl-token-2022 = "5"                    # NOT v6+/v10 (requires Solana SDK v3)
spl-transfer-hook-interface = "0.8"
spl-tlv-account-resolution = "0.7"
```

**TypeScript (package.json):**
```json
"@coral-xyz/anchor": "^0.31.1",
"@solana/spl-token": "^0.4.14",
"@solana/web3.js": "^1.98.0"
```

Use web3.js v1 (not v2). LiteSVM for testing (bankrun deprecated March 2025).

## Reference Implementation Patterns (from Vault Standard)

Follow the vault standard's code organization:
- **Program structure:** `lib.rs` (declare_id + thin instruction wrappers) → `instructions/` (handler per instruction) → `state.rs`, `error.rs`, `events.rs`, `math.rs`, `constants.rs`
- **Account sizing:** Explicit `LEN` const with discriminator + field breakdown
- **Reserved bytes:** `_reserved: [u8; 64]` in state accounts for future upgrades
- **SDK structure:** TypeScript with `vault.ts` (core class), `pda.ts` (address derivation), `math.ts` (client-side math), `cli.ts` (CLI entry)
- **Dependencies:** Anchor 0.31+, `anchor-spl` with token/associated_token/metadata features, `spl-token-2022`, `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`
- **Testing:** ts-mocha integration tests per variant, dedicated test helpers directory

## GENIUS Act Compliance Context (SSS-2)

SSS-2 maps to real regulatory requirements under the GENIUS Act:
- **Blacklist = OFAC sanctions screening** — issuers must screen and block sanctioned persons/countries
- **Freeze + Seize = mandatory technical capability** — law requires ability to "block, freeze, and reject" impermissible transactions, including secondary market
- **Audit trail** — annual compliance certification required; all operations must be logged with timestamps and operator identity
- **Per-minter quotas** align with issuance controls for compliance certification

## Expected Project Structure

```
programs/
  sss-token/         # Main Anchor program (both presets)
    src/
      lib.rs         # Program entry, thin instruction wrappers
      instructions/  # One file per instruction handler
      state.rs       # Account structs (StablecoinConfig, RoleAccount, BlacklistEntry)
      error.rs       # Custom error codes
      events.rs      # Anchor events for indexing
      constants.rs   # Seeds, limits
  transfer-hook/     # SSS-2 transfer hook program
sdk/                 # TypeScript SDK (@stbr/sss-token)
cli/                 # Admin CLI (sss-token)
services/            # Docker-containerized backend (Rust or TypeScript)
  mint-burn/         # Mint/Burn coordination
  indexer/           # Event listener/indexer
  compliance/        # SSS-2: blacklist management, sanctions
  webhook/           # SSS-2: event subscriptions with retry
tests/               # Integration tests + fuzz (Trident)
docs/                # 8 required docs
docker-compose.yml
```

## Build & Test Commands

```bash
# Anchor program
anchor build
anchor test                                    # full integration suite
anchor test -- tests/sss-1.ts                  # single test file
anchor deploy --provider.cluster devnet

# Formatting & linting
cargo fmt
cargo clippy -- -W clippy::all

# TypeScript SDK / CLI
yarn install
yarn build
yarn test

# Single Rust test
cargo test -p sss-token <test_name>

# Fuzz testing
trident fuzz run-hfuzz

# Backend services
docker compose up -d
docker compose logs -f <service>
```

## On-Chain Instructions

**Core (all presets):** `initialize`, `mint`, `burn`, `freeze_account`, `thaw_account`, `pause`, `unpause`, `update_minter`, `update_roles`, `transfer_authority`

**SSS-2 compliance:** `add_to_blacklist`, `remove_from_blacklist`, `seize`

## Security Invariants

- `overflow-checks = true` in release profile + `checked_add`/`checked_sub`/`checked_mul` for user-supplied values
- Store canonical PDA bumps in state, never recalculate (saves CU, prevents bump confusion)
- Validate all accounts (owner, signer, PDA derivation) — missing signer checks are #1 exploit cause
- Reload accounts after CPIs if modified (`.reload()`)
- Validate CPI target program IDs — prevent arbitrary CPI
- Transfer hook must verify `transferring` flag to prevent direct invocation
- No `unwrap()` in program code
- `remaining_accounts` has zero Anchor validation — always check manually
- Never use `init_if_needed` without explicit `is_initialized` flag (reinitialization attack)
- Verify mint matches expected mint for all Token-2022 accounts (account confusion / Cashio-style attack)
- Use `ExtensionType::try_calculate_account_len()` for account sizing — never manual calculation
- Seize must require target to be frozen (prevents accidental seizure of active accounts)
- Treasury address must be PDA-derived or hardcoded (prevents redirection)

## Evaluation Weights

SDK design & modularity (20%), Completeness (20%), Code quality (20%), Developer credentials (20%), Security (15%), Usability & docs (5%). Bonus features up to +50%: SSS-3 (confidential transfers), oracle integration, terminal UI, example frontend.
