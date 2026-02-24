use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use spl_token_2022::instruction as token_instruction;

use crate::constants::*;
use crate::error::SssError;
use crate::events::BurnEvent;
use crate::instructions::initialize::TOKEN_2022_PROGRAM_ID;
use crate::state::{RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(mut)]
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Burner.to_u8()], burner.key().as_ref()],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    /// CHECK: Validated by Token-2022 CPI — must match config.mint
    #[account(
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidMint,
    )]
    pub mint: AccountInfo<'info>,

    /// CHECK: Source token account — validated by Token-2022 CPI. Must be burner's own token account.
    #[account(mut)]
    pub burner_token_account: AccountInfo<'info>,

    /// CHECK: Token-2022 program
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    let config = &mut ctx.accounts.config;
    config.total_burned = config
        .total_burned
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;

    // Burn uses burner's own authority — they burn from their own account
    invoke(
        &token_instruction::burn(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.burner_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.burner.key(),
            &[],
            amount,
        )?,
        &[
            ctx.accounts.burner_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.burner.to_account_info(),
        ],
    )?;

    let clock = Clock::get()?;
    emit!(BurnEvent {
        authority: ctx.accounts.burner.key(),
        burner: ctx.accounts.burner.key(),
        amount,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
