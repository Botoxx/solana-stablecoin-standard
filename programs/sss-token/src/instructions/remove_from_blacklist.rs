use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::BlacklistRemoveEvent;
use crate::state::{BlacklistEntry, RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct RemoveFromBlacklist<'info> {
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.enable_transfer_hook @ SssError::ComplianceNotEnabled,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Blacklister.to_u8()], blacklister.key().as_ref()],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    #[account(
        mut,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.as_ref()],
        bump = blacklist_entry.bump,
        constraint = blacklist_entry.active @ SssError::NotBlacklisted,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn handler(ctx: Context<RemoveFromBlacklist>, address: Pubkey) -> Result<()> {
    // Soft delete for audit trail
    ctx.accounts.blacklist_entry.active = false;

    let clock = Clock::get()?;
    emit!(BlacklistRemoveEvent {
        authority: ctx.accounts.blacklister.key(),
        address,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
