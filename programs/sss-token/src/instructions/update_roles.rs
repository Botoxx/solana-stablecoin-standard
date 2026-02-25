use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::RoleUpdatedEvent;
use crate::state::{RoleAssignment, RoleType, StablecoinConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum RoleAction {
    Assign,
    Revoke,
}

#[derive(Accounts)]
#[instruction(address: Pubkey, role: RoleType, action: RoleAction)]
pub struct UpdateRoles<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ SssError::Unauthorized,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = RoleAssignment::LEN,
        seeds = [ROLE_SEED, config.key().as_ref(), &[role.to_u8()], address.as_ref()],
        bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateRoles>,
    address: Pubkey,
    role: RoleType,
    action: RoleAction,
) -> Result<()> {
    let clock = Clock::get()?;
    let role_assignment = &mut ctx.accounts.role_assignment;

    let action_str = match action {
        RoleAction::Assign => {
            // Guard against re-assignment — require fresh (zeroed) account
            require!(
                role_assignment.config == Pubkey::default(),
                SssError::RoleAlreadyAssigned
            );
            role_assignment.config = ctx.accounts.config.key();
            role_assignment.role_type = role.to_u8();
            role_assignment.address = address;
            role_assignment.assigned_by = ctx.accounts.authority.key();
            role_assignment.assigned_at = clock.unix_timestamp;
            role_assignment.bump = ctx.bumps.role_assignment;
            role_assignment._reserved = [0u8; 64];
            "assign"
        }
        RoleAction::Revoke => {
            require!(
                role_assignment.config == ctx.accounts.config.key(),
                SssError::InvalidRole
            );
            // Close the account — return lamports to authority and zero all data
            // to prevent stale fields from interfering with future re-assign
            let dest = ctx.accounts.authority.to_account_info();
            let source = role_assignment.to_account_info();
            let dest_lamports = dest.lamports();
            **dest.try_borrow_mut_lamports()? = dest_lamports
                .checked_add(source.lamports())
                .ok_or(SssError::Overflow)?;
            **source.try_borrow_mut_lamports()? = 0;
            let mut data = source.try_borrow_mut_data()?;
            data.fill(0);
            "revoke"
        }
    };

    emit!(RoleUpdatedEvent {
        authority: ctx.accounts.authority.key(),
        address,
        role: role.to_u8(),
        action: action_str.to_string(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
