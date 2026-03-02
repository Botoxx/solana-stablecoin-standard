use anchor_lang::prelude::Pubkey;

pub const ORACLE_FEED_SEED: &[u8] = b"oracle-feed";

/// sss-token program ID — same value used in transfer-hook
pub const SSS_TOKEN_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    219, 2, 26, 207, 253, 42, 122, 182, 60, 55, 70, 254, 234, 246, 38, 119, 55, 144, 190, 193, 241,
    22, 192, 224, 37, 158, 35, 29, 64, 50, 221, 142,
]);

/// Anchor discriminator for StablecoinConfig: sha256("account:StablecoinConfig")[..8]
pub const CONFIG_DISCRIMINATOR: [u8; 8] = [127, 25, 244, 213, 1, 192, 101, 6];

/// Switchboard PullFeedAccountData discriminator
pub const SWITCHBOARD_PULL_FEED_DISCRIMINATOR: [u8; 8] = [196, 27, 108, 196, 10, 215, 219, 40];

/// Maximum pair string length (e.g. "EUR/USD" = 7 chars, fits in 12)
pub const MAX_PAIR_LEN: usize = 12;

/// Maximum allowed price_decimals
pub const MAX_PRICE_DECIMALS: u8 = 18;

/// Feed type: Switchboard On-Demand
pub const FEED_TYPE_SWITCHBOARD: u8 = 0;

/// Feed type: Manual / CPI-indexed
pub const FEED_TYPE_MANUAL: u8 = 1;
