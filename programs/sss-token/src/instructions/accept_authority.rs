use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::AuthorityAcceptedEvent;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    let pending = config
        .pending_authority
        .ok_or(SssError::NoPendingAuthority)?;

    require!(
        pending == ctx.accounts.new_authority.key(),
        SssError::PendingAuthorityMismatch
    );

    let old_authority = config.authority;
    config.authority = pending;
    config.pending_authority = None;

    let clock = Clock::get()?;
    emit!(AuthorityAcceptedEvent {
        old_authority,
        new_authority: pending,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
