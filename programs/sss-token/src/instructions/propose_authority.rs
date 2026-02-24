use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::AuthorityProposedEvent;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct ProposeAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,
}

pub fn handler(ctx: Context<ProposeAuthority>, new_authority: Pubkey) -> Result<()> {
    ctx.accounts.config.pending_authority = Some(new_authority);

    let clock = Clock::get()?;
    emit!(AuthorityProposedEvent {
        authority: ctx.accounts.authority.key(),
        proposed: new_authority,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
