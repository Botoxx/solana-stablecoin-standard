# SSS Admin TUI

Interactive terminal dashboard for real-time monitoring and administration of SSS stablecoins on Solana.

## Features

- **6 screens**: Dashboard, Operations, Roles, Compliance, Events, Holders
- **15 admin operations**: mint, burn, freeze, thaw, pause, unpause, assign/revoke roles, add/update/remove minters, blacklist, seize
- **Real-time events** via WebSocket `logsSubscribe`
- **Live data refresh** with 5-second auto-poll
- **Keyboard-driven** navigation (lazygit/k9s style)
- **Dark financial aesthetic** matching the web frontend
- **SSS-1/SSS-2 aware**: compliance screen auto-hides for SSS-1 configs
- **Session persistence**: config saved to `~/.config/sss-tui/config.toml`

## Build

```bash
cd tui
cargo build --release
```

Binary: `target/release/sss-tui`

## Usage

```bash
# Default: connects to devnet, uses ~/.config/solana/id.json
sss-tui --config-pda <CONFIG_PDA_ADDRESS>

# Full options
sss-tui \
  --rpc-url https://api.devnet.solana.com \
  --ws-url wss://api.devnet.solana.com \
  --keypair ~/.config/solana/id.json \
  --config-pda Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1
```

## Keybindings

### Global
| Key | Action |
|-----|--------|
| `1`-`6` | Switch screens |
| `q` | Quit |
| `?` | Toggle help overlay |
| `r` | Force refresh |
| `Ctrl+C` | Force quit |

### Operations
| Key | Action |
|-----|--------|
| `e`/`i` | Enter edit mode |
| `Tab` | Next field / sub-tab |
| `Shift+Tab` | Previous field |
| `Enter` | Submit form |
| `Esc` | Cancel / normal mode |

### Roles & Compliance
| Key | Action |
|-----|--------|
| `a` | Assign role / Add minter / Add to blacklist |
| `d` | Revoke role / Remove minter / Remove from blacklist |
| `s` | Seize tokens (compliance) |
| `j`/`k` | Navigate table rows |

### Events
| Key | Action |
|-----|--------|
| `j`/`k` | Scroll up/down |
| `g`/`G` | Jump to top / bottom (auto-scroll) |
| `f` | Toggle filter |

## Architecture

Standalone Rust binary — **not** in the Anchor workspace (avoids SBF toolchain conflicts).

- **ratatui 0.30 + crossterm 0.29** — terminal rendering
- **solana-sdk 2 + solana-client 2** — RPC + transaction construction
- **borsh 0.10** — Anchor-compatible account/event deserialization
- **Manual instruction building** — sha2 discriminators, no anchor-client dependency
- **Async tokio** — `select!` on crossterm events + RPC + WebSocket + tick timer

## Tests

```bash
cargo test
```

149 tests across 11 files:
- `borsh_roundtrip.rs` — all 4 account types encode/decode correctly
- `pda_crosscheck.rs` — PDA derivation matches TypeScript SDK
- `event_parse.rs` — all 14 event types parse correctly
- `instruction_disc.rs` — all 15 instruction discriminators verified
- `config_persist.rs` — config save/load roundtrip
- `app_state.rs` — app state machine, toast lifecycle, event queue, theme helpers
- `input_handling.rs` — all screen input handlers, form validation, field cycling
- `error_parsing.rs` — error code mapping, tx log parsing
- `rpc_parsing.rs` — Token-2022 holder/supply/metadata byte parsing
- `render_screens.rs` — all 6 screens + overlays render without panics (TestBackend)
- `devnet_smoke.rs` — 5 end-to-end tests against real devnet data (run with `--ignored`)

## Screens

1. **Dashboard** — Token status, supply metrics, extension flags, minter quota gauges, recent events
2. **Operations** — Mint, Burn, Freeze, Thaw, Pause/Unpause with input validation and confirmation dialogs
3. **Roles** — Role assignment table + minter management with quota progress bars
4. **Compliance** — Blacklist table + seize flow (SSS-2 only, hidden for SSS-1)
5. **Events** — Real-time color-coded event stream with filtering and auto-scroll
6. **Holders** — Token holder table sorted by balance with frozen status and supply percentage
