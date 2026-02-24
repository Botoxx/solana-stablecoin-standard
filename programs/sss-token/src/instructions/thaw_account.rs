use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use spl_token_2022::instruction as token_instruction;

use crate::constants::*;
use crate::error::SssError;
use crate::events::ThawEvent;
use crate::instructions::initialize::TOKEN_2022_PROGRAM_ID;
use crate::state::StablecoinConfig;

#[derive(Accounts)]
pub struct ThawTokenAccount<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ SssError::Unauthorized,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Validated by Token-2022 CPI — must match config.mint
    #[account(
        constraint = mint.key() == config.mint @ SssError::InvalidMint,
    )]
    pub mint: AccountInfo<'info>,

    /// CHECK: Token account to thaw — validated by Token-2022 CPI
    #[account(mut)]
    pub token_account: AccountInfo<'info>,

    /// CHECK: Token-2022 program
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_program: AccountInfo<'info>,
}

pub fn handler(ctx: Context<ThawTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.config.mint;
    let bump = ctx.accounts.config.bump;
    let config_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[bump]];

    invoke_signed(
        &token_instruction::thaw_account(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.config.key(),
            &[],
        )?,
        &[
            ctx.accounts.token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    let clock = Clock::get()?;
    emit!(ThawEvent {
        authority: ctx.accounts.authority.key(),
        account: ctx.accounts.token_account.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
