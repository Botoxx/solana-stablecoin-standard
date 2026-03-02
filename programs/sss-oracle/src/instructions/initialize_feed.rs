use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::OracleError;
use crate::events::FeedInitializedEvent;
use crate::instructions::cache_price::pair_bytes_to_string;
use crate::state::OracleFeedConfig;
use crate::validation::read_config_authority;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitFeedParams {
    pub pair: [u8; 12],
    pub feed_account: Pubkey,
    pub feed_type: u8,
    pub max_staleness: u32,
    pub min_samples: u8,
    pub max_confidence: u64,
    pub price_decimals: u8,
    /// Switchboard program ID for this cluster (mainnet vs devnet).
    /// Stored in the feed config and validated in cache_price.
    /// Ignored for manual feeds (feed_type == 1).
    pub switchboard_program: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitFeedParams)]
pub struct InitializeFeed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: StablecoinConfig from sss-token — validated via read_config_authority
    pub config: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        space = OracleFeedConfig::LEN,
        seeds = [ORACLE_FEED_SEED, config.key().as_ref(), params.pair.as_ref()],
        bump,
    )]
    pub oracle_feed: Account<'info, OracleFeedConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeFeed>, params: InitFeedParams) -> Result<()> {
    let config_authority = read_config_authority(&ctx.accounts.config)?;
    require!(
        config_authority == ctx.accounts.authority.key(),
        OracleError::InvalidAuthority
    );

    // Validate pair is non-empty (at least one non-zero byte)
    require!(
        params.pair.iter().any(|&b| b != 0),
        OracleError::InvalidPair
    );

    // Validate feed_type
    require!(
        params.feed_type == FEED_TYPE_SWITCHBOARD || params.feed_type == FEED_TYPE_MANUAL,
        OracleError::InvalidFeedType
    );

    // Validate price_decimals
    require!(
        params.price_decimals <= MAX_PRICE_DECIMALS,
        OracleError::InvalidDecimals
    );

    let clock = Clock::get()?;
    let oracle_feed = &mut ctx.accounts.oracle_feed;

    oracle_feed.config = ctx.accounts.config.key();
    oracle_feed.authority = ctx.accounts.authority.key();
    oracle_feed.feed_account = params.feed_account;
    oracle_feed.switchboard_program = params.switchboard_program;
    oracle_feed.pair = params.pair;
    oracle_feed.max_staleness = params.max_staleness;
    oracle_feed.min_samples = params.min_samples;
    oracle_feed.max_confidence = params.max_confidence;
    oracle_feed.price_decimals = params.price_decimals;
    oracle_feed.enabled = true;
    oracle_feed.feed_type = params.feed_type;
    oracle_feed.last_cached_price = 0;
    oracle_feed.last_cached_slot = 0;
    oracle_feed.last_cached_ts = 0;
    oracle_feed.bump = ctx.bumps.oracle_feed;
    oracle_feed._reserved = [0u8; 64];

    let pair_str = pair_bytes_to_string(&params.pair);

    emit!(FeedInitializedEvent {
        config: ctx.accounts.config.key(),
        authority: ctx.accounts.authority.key(),
        feed_pda: ctx.accounts.oracle_feed.key(),
        pair: pair_str,
        feed_type: params.feed_type,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
