use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use spl_token_2022::instruction as token_instruction;

use crate::constants::*;
use crate::error::SssError;
use crate::events::SeizeEvent;
use crate::instructions::initialize::TOKEN_2022_PROGRAM_ID;
use crate::state::{RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
pub struct Seize<'info> {
    pub seizer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.enable_permanent_delegate @ SssError::ComplianceNotEnabled,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Seizer.to_u8()], seizer.key().as_ref()],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    /// CHECK: Validated by Token-2022 CPI — must match config.mint
    #[account(
        constraint = mint.key() == config.mint @ SssError::InvalidMint,
    )]
    pub mint: AccountInfo<'info>,

    /// CHECK: Source token account to seize from — must be frozen. Validated by Token-2022 CPI.
    #[account(mut)]
    pub source_token_account: AccountInfo<'info>,

    /// CHECK: Treasury token account. Validated by Token-2022 CPI.
    #[account(mut)]
    pub treasury_token_account: AccountInfo<'info>,

    /// CHECK: Token-2022 program
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<Seize>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    // Verify the source account is frozen (freeze-before-seize)
    let source_data = ctx.accounts.source_token_account.try_borrow_data()?;
    // Token-2022 account: state byte is at offset 108
    // AccountState: 0=Uninitialized, 1=Initialized, 2=Frozen
    require!(source_data.len() > 108, SssError::AccountNotFrozen);
    let account_state = source_data[108];
    require!(account_state == 2, SssError::AccountNotFrozen);
    drop(source_data);

    let mint_key = ctx.accounts.config.mint;
    let bump = ctx.accounts.config.bump;
    let config_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[bump]];

    // Use permanent delegate authority to transfer
    invoke_signed(
        &token_instruction::transfer_checked(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.source_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.treasury_token_account.key(),
            &ctx.accounts.config.key(), // permanent delegate
            &[],
            amount,
            ctx.accounts.config.decimals,
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.treasury_token_account.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    let clock = Clock::get()?;
    emit!(SeizeEvent {
        authority: ctx.accounts.seizer.key(),
        source: ctx.accounts.source_token_account.key(),
        treasury: ctx.accounts.treasury_token_account.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
