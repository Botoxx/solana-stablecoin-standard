use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::OracleError;
use crate::events::FeedClosedEvent;
use crate::instructions::cache_price::pair_bytes_to_string;
use crate::state::OracleFeedConfig;

#[derive(Accounts)]
pub struct CloseFeed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_FEED_SEED, oracle_feed.config.as_ref(), oracle_feed.pair.as_ref()],
        bump = oracle_feed.bump,
        constraint = oracle_feed.authority == authority.key() @ OracleError::InvalidAuthority,
    )]
    pub oracle_feed: Account<'info, OracleFeedConfig>,
}

pub fn handler(ctx: Context<CloseFeed>) -> Result<()> {
    let clock = Clock::get()?;
    let oracle_feed = &ctx.accounts.oracle_feed;

    let pair_str = pair_bytes_to_string(&oracle_feed.pair);
    let feed_pda = oracle_feed.key();

    emit!(FeedClosedEvent {
        feed_pda,
        authority: ctx.accounts.authority.key(),
        pair: pair_str,
        timestamp: clock.unix_timestamp,
    });

    // Close account: transfer lamports to authority and zero all data
    let dest = ctx.accounts.authority.to_account_info();
    let source = ctx.accounts.oracle_feed.to_account_info();
    let dest_lamports = dest.lamports();
    **dest.try_borrow_mut_lamports()? = dest_lamports
        .checked_add(source.lamports())
        .ok_or(OracleError::Overflow)?;
    **source.try_borrow_mut_lamports()? = 0;
    let mut data = source.try_borrow_mut_data()?;
    data.fill(0);

    Ok(())
}
