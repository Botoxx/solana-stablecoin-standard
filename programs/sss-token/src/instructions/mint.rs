use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use spl_token_2022::instruction as token_instruction;

use crate::constants::*;
use crate::error::SssError;
use crate::events::MintEvent;
use crate::instructions::initialize::TOKEN_2022_PROGRAM_ID;
use crate::state::{MinterConfig, RoleAssignment, RoleType, StablecoinConfig};

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Minter.to_u8()], minter.key().as_ref()],
        bump = role_assignment.bump,
    )]
    pub role_assignment: Account<'info, RoleAssignment>,

    #[account(
        mut,
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump = minter_config.bump,
    )]
    pub minter_config: Account<'info, MinterConfig>,

    /// CHECK: Validated by Token-2022 CPI — must match config.mint
    #[account(
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidMint,
    )]
    pub mint: AccountInfo<'info>,

    /// CHECK: Recipient token account — validated by Token-2022 CPI
    #[account(mut)]
    pub recipient_token_account: AccountInfo<'info>,

    /// CHECK: Token-2022 program
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::InvalidAmount);

    let minter_config = &mut ctx.accounts.minter_config;
    require!(
        minter_config.quota_remaining >= amount,
        SssError::QuotaExceeded
    );

    minter_config.quota_remaining = minter_config
        .quota_remaining
        .checked_sub(amount)
        .ok_or(SssError::Overflow)?;

    let config = &mut ctx.accounts.config;
    config.total_minted = config
        .total_minted
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;

    let mint_key = config.mint;
    let bump = config.bump;
    let config_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[bump]];

    invoke_signed(
        &token_instruction::mint_to(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.mint.key(),
            &ctx.accounts.recipient_token_account.key(),
            &ctx.accounts.config.key(),
            &[],
            amount,
        )?,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.recipient_token_account.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    let clock = Clock::get()?;
    emit!(MintEvent {
        authority: ctx.accounts.minter.key(),
        minter: ctx.accounts.minter.key(),
        recipient: ctx.accounts.recipient_token_account.key(),
        amount,
        remaining_quota: ctx.accounts.minter_config.quota_remaining,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
