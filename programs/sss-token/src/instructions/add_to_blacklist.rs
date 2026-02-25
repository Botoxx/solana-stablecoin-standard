use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::BlacklistAddEvent;
use crate::state::{BlacklistEntry, RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
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
        init_if_needed,
        payer = blacklister,
        space = BlacklistEntry::LEN,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddToBlacklist>, address: Pubkey, reason: String) -> Result<()> {
    require!(!reason.is_empty(), SssError::BlacklistReasonRequired);
    require!(
        reason.len() <= MAX_REASON_LENGTH,
        SssError::BlacklistReasonTooLong
    );

    let entry = &mut ctx.accounts.blacklist_entry;

    // If already initialized and active, it's a duplicate
    if entry.config != Pubkey::default() && entry.active {
        return Err(SssError::AlreadyBlacklisted.into());
    }

    let clock = Clock::get()?;

    entry.config = ctx.accounts.config.key();
    entry.address = address;
    entry.reason = reason.clone();
    entry.blacklisted_at = clock.unix_timestamp;
    entry.blacklisted_by = ctx.accounts.blacklister.key();
    entry.active = true;
    entry.bump = ctx.bumps.blacklist_entry;
    entry._reserved = [0u8; 64];

    emit!(BlacklistAddEvent {
        authority: ctx.accounts.blacklister.key(),
        address,
        reason,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
