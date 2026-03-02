use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::OracleError;
use crate::events::ManualPriceSetEvent;
use crate::state::OracleFeedConfig;

#[derive(Accounts)]
pub struct SetManualPrice<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_FEED_SEED, oracle_feed.config.as_ref(), oracle_feed.pair.as_ref()],
        bump = oracle_feed.bump,
        constraint = oracle_feed.authority == authority.key() @ OracleError::InvalidAuthority,
        constraint = oracle_feed.feed_type == FEED_TYPE_MANUAL @ OracleError::InvalidFeedType,
    )]
    pub oracle_feed: Account<'info, OracleFeedConfig>,
}

pub fn handler(ctx: Context<SetManualPrice>, price: u64) -> Result<()> {
    require!(price > 0, OracleError::InvalidPrice);

    let clock = Clock::get()?;
    let oracle_feed = &mut ctx.accounts.oracle_feed;

    oracle_feed.last_cached_price = price;
    oracle_feed.last_cached_slot = clock.slot;
    oracle_feed.last_cached_ts = clock.unix_timestamp;

    emit!(ManualPriceSetEvent {
        feed_pda: ctx.accounts.oracle_feed.key(),
        authority: ctx.accounts.authority.key(),
        price,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
