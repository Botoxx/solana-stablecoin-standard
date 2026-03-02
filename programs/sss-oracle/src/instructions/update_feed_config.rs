use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::OracleError;
use crate::events::FeedConfigUpdatedEvent;
use crate::state::OracleFeedConfig;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateFeedParams {
    pub max_staleness: Option<u32>,
    pub min_samples: Option<u8>,
    pub max_confidence: Option<u64>,
    pub price_decimals: Option<u8>,
    pub enabled: Option<bool>,
    pub feed_account: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateFeedConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [ORACLE_FEED_SEED, oracle_feed.config.as_ref(), oracle_feed.pair.as_ref()],
        bump = oracle_feed.bump,
        constraint = oracle_feed.authority == authority.key() @ OracleError::InvalidAuthority,
    )]
    pub oracle_feed: Account<'info, OracleFeedConfig>,
}

pub fn handler(ctx: Context<UpdateFeedConfig>, params: UpdateFeedParams) -> Result<()> {
    let clock = Clock::get()?;
    let oracle_feed = &mut ctx.accounts.oracle_feed;
    let mut changed = Vec::new();

    if let Some(v) = params.max_staleness {
        oracle_feed.max_staleness = v;
        changed.push("max_staleness");
    }
    if let Some(v) = params.min_samples {
        oracle_feed.min_samples = v;
        changed.push("min_samples");
    }
    if let Some(v) = params.max_confidence {
        oracle_feed.max_confidence = v;
        changed.push("max_confidence");
    }
    if let Some(v) = params.price_decimals {
        require!(v <= MAX_PRICE_DECIMALS, OracleError::InvalidDecimals);
        if v != oracle_feed.price_decimals {
            oracle_feed.price_decimals = v;
            // Invalidate cached price — decimal change alters its interpretation
            oracle_feed.last_cached_price = 0;
            oracle_feed.last_cached_slot = 0;
            oracle_feed.last_cached_ts = 0;
            changed.push("price_decimals");
        }
    }
    if let Some(v) = params.enabled {
        oracle_feed.enabled = v;
        changed.push("enabled");
    }
    if let Some(v) = params.feed_account {
        oracle_feed.feed_account = v;
        changed.push("feed_account");
    }

    // Only emit event if at least one field was actually changed
    if !changed.is_empty() {
        let field_changed = changed.join(",");
        emit!(FeedConfigUpdatedEvent {
            feed_pda: ctx.accounts.oracle_feed.key(),
            authority: ctx.accounts.authority.key(),
            field_changed,
            timestamp: clock.unix_timestamp,
        });
    }

    Ok(())
}
