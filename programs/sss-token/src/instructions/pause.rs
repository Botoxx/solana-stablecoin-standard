use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::PauseEvent;
use crate::state::{RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
pub struct Pause<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Pauser.to_u8()], pauser.key().as_ref()],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,
}

pub fn handler(ctx: Context<Pause>) -> Result<()> {
    ctx.accounts.config.paused = true;

    let clock = Clock::get()?;
    emit!(PauseEvent {
        authority: ctx.accounts.pauser.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
