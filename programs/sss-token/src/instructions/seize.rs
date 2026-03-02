use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use spl_token_2022::instruction as token_instruction;

use crate::constants::*;
use crate::error::SssError;
use crate::events::SeizeEvent;
use crate::instructions::initialize::TOKEN_2022_PROGRAM_ID;
use crate::state::{RoleAssignment, RoleType, StablecoinConfig};

/// Seize tokens from a frozen account into the treasury via burn+mint.
///
/// **Design note:** Seize intentionally has NO pause check. The pause mechanism
/// halts user-initiated transfers, but compliance seizure must remain operational
/// during emergencies — this is a GENIUS Act requirement ("block, freeze, and
/// reject" must work at all times, including during system pause).
#[derive(Accounts)]
pub struct Seize<'info> {
    pub seizer: Signer<'info>,

    #[account(
        mut,
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
        mut,
        constraint = mint.key() == config.mint @ SssError::InvalidMint,
    )]
    pub mint: AccountInfo<'info>,

    /// CHECK: Source token account to seize from — must be frozen and owned by Token-2022.
    /// Mint and frozen state validated manually from account data before CPI.
    #[account(
        mut,
        constraint = *source_token_account.owner == TOKEN_2022_PROGRAM_ID @ SssError::InvalidMint,
    )]
    pub source_token_account: AccountInfo<'info>,

    /// CHECK: Treasury token account. Owner validated against config.treasury. Mint validated by Token-2022 CPI.
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
    require!(source_data.len() > 108, SssError::AccountNotFrozen);
    // Token-2022 account layout: mint(32) at offset 0
    let source_mint = Pubkey::try_from(&source_data[0..32]).map_err(|_| SssError::InvalidMint)?;
    require!(
        source_mint == ctx.accounts.config.mint,
        SssError::InvalidMint
    );
    // AccountState at offset 108: 0=Uninitialized, 1=Initialized, 2=Frozen
    let account_state = source_data[108];
    require!(account_state == 2, SssError::AccountNotFrozen);
    drop(source_data);

    // Validate treasury token account
    let treasury_data = ctx.accounts.treasury_token_account.try_borrow_data()?;
    require!(treasury_data.len() >= 64, SssError::InvalidTreasury);
    // Validate mint matches config.mint
    let treasury_mint =
        Pubkey::try_from(&treasury_data[0..32]).map_err(|_| SssError::InvalidMint)?;
    require!(
        treasury_mint == ctx.accounts.config.mint,
        SssError::InvalidMint
    );
    // Validate owner matches config.treasury
    let treasury_owner =
        Pubkey::try_from(&treasury_data[32..64]).map_err(|_| SssError::InvalidTreasury)?;
    require!(
        treasury_owner == ctx.accounts.config.treasury,
        SssError::InvalidTreasury
    );
    drop(treasury_data);

    let mint_key = ctx.accounts.config.mint;
    let decimals = ctx.accounts.config.decimals;
    let bump = ctx.accounts.config.bump;
    let config_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[bump]];

    // 1. Thaw the source account (config PDA is freeze authority)
    invoke_signed(
        &token_instruction::thaw_account(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.source_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.config.key(),
            &[],
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // 2. Burn tokens from source using permanent delegate authority
    //    burn_checked does NOT trigger transfer hooks
    invoke_signed(
        &token_instruction::burn_checked(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.source_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.config.key(), // permanent delegate
            &[],
            amount,
            decimals,
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // 3. Mint equivalent tokens to treasury (config PDA is mint authority)
    //    mint_to does NOT trigger transfer hooks
    invoke_signed(
        &token_instruction::mint_to(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.mint.key(),
            &ctx.accounts.treasury_token_account.key(),
            &ctx.accounts.config.key(), // mint authority
            &[],
            amount,
        )?,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.treasury_token_account.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // 4. Re-freeze the source account
    invoke_signed(
        &token_instruction::freeze_account(
            &TOKEN_2022_PROGRAM_ID,
            &ctx.accounts.source_token_account.key(),
            &ctx.accounts.mint.key(),
            &ctx.accounts.config.key(),
            &[],
        )?,
        &[
            ctx.accounts.source_token_account.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // Update accounting: seize = burn from source + mint to treasury
    let config = &mut ctx.accounts.config;
    config.total_burned = config
        .total_burned
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;
    config.total_minted = config
        .total_minted
        .checked_add(amount)
        .ok_or(SssError::Overflow)?;

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
