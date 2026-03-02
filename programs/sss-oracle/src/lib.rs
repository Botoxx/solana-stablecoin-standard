use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod validation;

use instructions::*;

declare_id!("ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k");

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "SSS Oracle",
    project_url: "https://github.com/solanabr/solana-stablecoin-standard",
    contacts: "link:https://github.com/solanabr/solana-stablecoin-standard/issues",
    policy: "https://github.com/solanabr/solana-stablecoin-standard/blob/main/SECURITY.md",
    preferred_languages: "en,pt",
    source_code: "https://github.com/solanabr/solana-stablecoin-standard",
    auditors: "None"
}

#[program]
pub mod sss_oracle {
    use super::*;

    pub fn initialize_feed(ctx: Context<InitializeFeed>, params: InitFeedParams) -> Result<()> {
        instructions::initialize_feed::handler(ctx, params)
    }

    pub fn update_feed_config(
        ctx: Context<UpdateFeedConfig>,
        params: UpdateFeedParams,
    ) -> Result<()> {
        instructions::update_feed_config::handler(ctx, params)
    }

    pub fn cache_price(ctx: Context<CachePrice>) -> Result<()> {
        instructions::cache_price::handler(ctx)
    }

    pub fn set_manual_price(ctx: Context<SetManualPrice>, price: u64) -> Result<()> {
        instructions::set_manual_price::handler(ctx, price)
    }

    pub fn close_feed(ctx: Context<CloseFeed>) -> Result<()> {
        instructions::close_feed::handler(ctx)
    }
}
