use anchor_lang::prelude::*;

#[account]
pub struct OracleFeedConfig {
    /// The StablecoinConfig PDA this feed is associated with
    pub config: Pubkey,
    /// Authority that can manage this feed (copied from config at init time)
    pub authority: Pubkey,
    /// Switchboard pull feed account (type 0) or Pubkey::default for manual (type 1)
    pub feed_account: Pubkey,
    /// Switchboard program ID (stored at init, cluster-agnostic).
    /// Validated in cache_price to ensure feed_account is owned by this program.
    pub switchboard_program: Pubkey,
    /// Currency pair identifier, e.g. "EUR/USD", "BRL/USD", "CPI" — zero-padded
    pub pair: [u8; 12],
    /// Maximum allowed staleness in slots for Switchboard feeds
    pub max_staleness: u32,
    /// Minimum number of oracle samples required
    pub min_samples: u8,
    /// Maximum acceptable confidence interval (std dev) in price units
    pub max_confidence: u64,
    /// Number of decimal places for the cached price
    pub price_decimals: u8,
    /// Whether this feed is active
    pub enabled: bool,
    /// 0 = Switchboard On-Demand, 1 = Manual/CPI-indexed
    pub feed_type: u8,
    /// Last cached price (scaled by 10^price_decimals)
    pub last_cached_price: u64,
    /// Slot at which the price was last cached
    pub last_cached_slot: u64,
    /// Unix timestamp of last cache
    pub last_cached_ts: i64,
    /// PDA bump
    pub bump: u8,
    /// Reserved for future upgrades
    pub _reserved: [u8; 64],
}

impl OracleFeedConfig {
    pub const LEN: usize = 8  // discriminator
        + 32                   // config
        + 32                   // authority
        + 32                   // feed_account
        + 32                   // switchboard_program
        + 12                   // pair
        + 4                    // max_staleness
        + 1                    // min_samples
        + 8                    // max_confidence
        + 1                    // price_decimals
        + 1                    // enabled
        + 1                    // feed_type
        + 8                    // last_cached_price
        + 8                    // last_cached_slot
        + 8                    // last_cached_ts
        + 1                    // bump
        + 64; // _reserved
}
