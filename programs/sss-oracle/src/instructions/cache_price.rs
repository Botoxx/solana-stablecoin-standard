use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::OracleError;
use crate::events::PriceCachedEvent;
use crate::state::OracleFeedConfig;

/// Switchboard On-Demand `PullFeedAccountData` binary layout (repr(C)):
///
///   submissions: [OracleSubmission; 32]   2048 bytes  (offset 0)
///   authority: Pubkey                       32 bytes
///   queue: Pubkey                           32 bytes
///   feed_hash: [u8; 32]                     32 bytes
///   initialized_at: i64                      8 bytes
///   permissions: u64                         8 bytes
///   max_variance: u64                        8 bytes
///   min_responses: u32                       4 bytes
///   name: [u8; 32]                          32 bytes
///   padding1: [u8; 1]                        1 byte
///   permit_write_by_authority: u8            1 byte
///   historical_result_idx: u8                1 byte
///   min_sample_size: u8                      1 byte
///   last_update_timestamp: i64               8 bytes
///   lut_slot: u64                            8 bytes
///   _reserved1: [u8; 32]                    32 bytes
///   result: CurrentResult                  128 bytes  (offset 2256)
///     value: i128         (16)  — median price, 18 decimal fixed-point
///     std_dev: i128       (16)  — standard deviation, 18 decimal
///     mean: i128          (16)
///     range: i128         (16)
///     min_value: i128     (16)
///     max_value: i128     (16)
///     num_samples: u8     (1)
///     submission_idx: u8  (1)
///     padding1: [u8; 6]   (6)
///     slot: u64           (8)   — slot of last update
///     min_slot: u64       (8)
///     max_slot: u64       (8)
///
/// Source: docs.rs/switchboard-on-demand/0.11.3/src/switchboard_on_demand/
///         on_demand/accounts/pull_feed.rs
///
/// After the 8-byte Anchor discriminator, CurrentResult starts at byte 2256.

/// Offset from start of data (after discriminator) to CurrentResult
const RESULT_OFFSET: usize = 2256;

/// Switchboard values use 18 decimal fixed-point (i128 * 10^-18)
const SWITCHBOARD_DECIMALS: u8 = 18;

/// Minimum account data length: discriminator(8) + RESULT_OFFSET + CurrentResult(128)
const MIN_FEED_DATA_LEN: usize = 8 + RESULT_OFFSET + 128;

/// Offsets within CurrentResult (all relative to result start)
const VALUE_OFFSET: usize = 0; // i128, 16 bytes
const STD_DEV_OFFSET: usize = 16; // i128, 16 bytes
const NUM_SAMPLES_OFFSET: usize = 96; // u8, 1 byte
const SLOT_OFFSET: usize = 104; // u64, 8 bytes

#[derive(Accounts)]
pub struct CachePrice<'info> {
    /// CHECK: Switchboard pull feed account — validated by owner + discriminator + feed key match
    pub feed_account: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [ORACLE_FEED_SEED, oracle_feed.config.as_ref(), oracle_feed.pair.as_ref()],
        bump = oracle_feed.bump,
        constraint = oracle_feed.enabled @ OracleError::FeedDisabled,
        constraint = oracle_feed.feed_type == FEED_TYPE_SWITCHBOARD @ OracleError::InvalidFeedType,
        constraint = oracle_feed.feed_account == feed_account.key() @ OracleError::FeedAccountMismatch,
    )]
    pub oracle_feed: Account<'info, OracleFeedConfig>,
}

pub fn handler(ctx: Context<CachePrice>) -> Result<()> {
    let feed_info = &ctx.accounts.feed_account;

    // Validate Switchboard ownership — uses stored PID (cluster-agnostic)
    require!(
        *feed_info.owner == ctx.accounts.oracle_feed.switchboard_program,
        OracleError::InvalidFeedOwner
    );

    let data = feed_info.try_borrow_data()?;

    // Validate length and discriminator
    require!(
        data.len() >= MIN_FEED_DATA_LEN,
        OracleError::InvalidSwitchboardData
    );
    require!(
        data[..8] == SWITCHBOARD_PULL_FEED_DISCRIMINATOR,
        OracleError::InvalidSwitchboardData
    );

    // Parse CurrentResult fields at RESULT_OFFSET (after 8-byte discriminator)
    let base = 8 + RESULT_OFFSET;

    let value = read_i128(&data, base + VALUE_OFFSET)?;
    let std_dev = read_i128(&data, base + STD_DEV_OFFSET)?;
    let num_samples = data[base + NUM_SAMPLES_OFFSET];
    let last_update_slot = read_u64(&data, base + SLOT_OFFSET)?;

    drop(data);

    let oracle_feed = &mut ctx.accounts.oracle_feed;

    // Check minimum samples
    require!(
        num_samples >= oracle_feed.min_samples,
        OracleError::InvalidSwitchboardData
    );

    // Check staleness
    let clock = Clock::get()?;
    let current_slot = clock.slot;
    let slot_diff = current_slot.saturating_sub(last_update_slot);
    require!(
        slot_diff <= oracle_feed.max_staleness as u64,
        OracleError::StalePrice
    );

    // Convert Switchboard 18-decimal fixed-point i128 to u64 with target decimals
    let price = switchboard_to_u64(value, oracle_feed.price_decimals)?;

    // Check confidence (std_dev converted to same scale)
    // max_confidence == 0 means confidence check is disabled
    if oracle_feed.max_confidence > 0 {
        let abs_std_dev = std_dev.saturating_abs();
        let confidence = switchboard_to_u64(abs_std_dev, oracle_feed.price_decimals)?;
        require!(
            confidence <= oracle_feed.max_confidence,
            OracleError::ExcessiveConfidence
        );
    }

    let timestamp = clock.unix_timestamp;

    let pair_str = pair_bytes_to_string(&oracle_feed.pair);

    oracle_feed.last_cached_price = price;
    oracle_feed.last_cached_slot = current_slot;
    oracle_feed.last_cached_ts = timestamp;

    emit!(PriceCachedEvent {
        feed_pda: ctx.accounts.oracle_feed.key(),
        pair: pair_str,
        price,
        slot: current_slot,
        timestamp,
    });

    Ok(())
}

fn read_i128(data: &[u8], offset: usize) -> Result<i128> {
    let bytes: [u8; 16] = data[offset..offset + 16]
        .try_into()
        .map_err(|_| error!(OracleError::InvalidSwitchboardData))?;
    Ok(i128::from_le_bytes(bytes))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    let bytes: [u8; 8] = data[offset..offset + 8]
        .try_into()
        .map_err(|_| error!(OracleError::InvalidSwitchboardData))?;
    Ok(u64::from_le_bytes(bytes))
}

/// Convert a Switchboard 18-decimal fixed-point i128 value to a u64
/// with the target number of decimal places.
///
/// Switchboard stores values as `value * 10^18`. To convert to
/// `price * 10^price_decimals`, we divide by `10^(18 - price_decimals)`.
///
/// E.g. value = 1_085_000_000_000_000_000 (1.085 in 18-decimal)
///      price_decimals = 6 → divide by 10^12 → 1_085_000
fn switchboard_to_u64(value: i128, price_decimals: u8) -> Result<u64> {
    require!(value > 0, OracleError::InvalidPrice);

    let scale_diff = SWITCHBOARD_DECIMALS
        .checked_sub(price_decimals)
        .ok_or(error!(OracleError::Overflow))?;

    let divisor = 10i128
        .checked_pow(scale_diff as u32)
        .ok_or(error!(OracleError::Overflow))?;

    let result = value
        .checked_div(divisor)
        .ok_or(error!(OracleError::Overflow))?;

    u64::try_from(result).map_err(|_| error!(OracleError::Overflow))
}

/// Convert a pair byte array to a string for event logging.
/// Falls back to hex representation if bytes are not valid UTF-8.
pub(crate) fn pair_bytes_to_string(pair: &[u8; 12]) -> String {
    match core::str::from_utf8(pair) {
        Ok(s) => s.trim_end_matches('\0').to_string(),
        Err(_) => {
            let hex: Vec<String> = pair.iter().map(|b| format!("{:02x}", b)).collect();
            format!("0x{}", hex.join(""))
        }
    }
}
