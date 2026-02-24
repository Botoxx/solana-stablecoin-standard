use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::UnpauseEvent;
use crate::state::{RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
pub struct Unpause<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.paused @ SssError::NotPaused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Pauser.to_u8()], pauser.key().as_ref()],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,
}

pub fn handler(ctx: Context<Unpause>) -> Result<()> {
    ctx.accounts.config.paused = false;

    let clock = Clock::get()?;
    emit!(UnpauseEvent {
        authority: ctx.accounts.pauser.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
