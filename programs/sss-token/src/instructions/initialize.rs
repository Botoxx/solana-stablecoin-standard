use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use spl_token_2022::{
    extension::{
        default_account_state::instruction as default_account_state_instruction,
        metadata_pointer::instruction as metadata_pointer_instruction,
        transfer_hook::instruction as transfer_hook_instruction,
        ExtensionType,
    },
    instruction as token_instruction,
};
use spl_token_metadata_interface::instruction as metadata_instruction;

use crate::constants::*;
use crate::error::SssError;
use crate::events::InitializeEvent;
use crate::state::StablecoinConfig;

pub const TOKEN_2022_PROGRAM_ID: Pubkey = spl_token_2022::ID;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub transfer_hook_program_id: Option<Pubkey>,
    pub treasury: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = StablecoinConfig::LEN,
        seeds = [CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: Mint account created via CPI to Token-2022. Validated by program logic.
    #[account(mut)]
    pub mint: Signer<'info>,

    /// CHECK: Token-2022 program
    #[account(address = TOKEN_2022_PROGRAM_ID)]
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    require!(
        params.name.len() <= MAX_NAME_LENGTH,
        SssError::InvalidStringLength
    );
    require!(
        params.symbol.len() <= MAX_SYMBOL_LENGTH,
        SssError::InvalidStringLength
    );
    require!(
        params.uri.len() <= MAX_URI_LENGTH,
        SssError::InvalidStringLength
    );
    if params.enable_transfer_hook {
        require!(
            params.transfer_hook_program_id.is_some(),
            SssError::ComplianceNotEnabled
        );
    }

    let mint_key = ctx.accounts.mint.key();
    let config_bump = ctx.bumps.config;
    let config_seeds: &[&[u8]] = &[CONFIG_SEED, mint_key.as_ref(), &[config_bump]];

    // Determine required extensions
    let mut extension_types = vec![ExtensionType::MetadataPointer];
    if params.enable_permanent_delegate {
        extension_types.push(ExtensionType::PermanentDelegate);
    }
    if params.enable_transfer_hook {
        extension_types.push(ExtensionType::TransferHook);
    }
    if params.default_account_frozen {
        extension_types.push(ExtensionType::DefaultAccountState);
    }

    // Calculate mint account size with all extensions
    let space = ExtensionType::try_calculate_account_len::<spl_token_2022::state::Mint>(
        &extension_types,
    )
    .map_err(|_| SssError::Overflow)?;

    // Add space for metadata (name + symbol + uri + padding)
    let metadata_space = 256 + params.name.len() + params.symbol.len() + params.uri.len();
    let total_space = space
        .checked_add(metadata_space)
        .ok_or(SssError::Overflow)?;

    let rent = &ctx.accounts.rent;
    let lamports = rent.minimum_balance(total_space);

    // 1. Create mint account owned by Token-2022
    invoke(
        &anchor_lang::solana_program::system_instruction::create_account(
            ctx.accounts.authority.key,
            ctx.accounts.mint.key,
            lamports,
            total_space as u64,
            &TOKEN_2022_PROGRAM_ID,
        ),
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let config_pubkey = ctx.accounts.config.key();

    // 2. Initialize permanent delegate (if enabled) — must be before InitializeMint
    if params.enable_permanent_delegate {
        invoke_signed(
            &token_instruction::initialize_permanent_delegate(
                &TOKEN_2022_PROGRAM_ID,
                ctx.accounts.mint.key,
                &config_pubkey,
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[config_seeds],
        )?;
    }

    // 3. Initialize transfer hook (if enabled)
    if params.enable_transfer_hook {
        let hook_program_id = params.transfer_hook_program_id.unwrap();
        invoke_signed(
            &transfer_hook_instruction::initialize(
                &TOKEN_2022_PROGRAM_ID,
                ctx.accounts.mint.key,
                Some(config_pubkey),
                Some(hook_program_id),
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[config_seeds],
        )?;
    }

    // 4. Initialize default account state (if frozen)
    if params.default_account_frozen {
        invoke_signed(
            &default_account_state_instruction::initialize_default_account_state(
                &TOKEN_2022_PROGRAM_ID,
                ctx.accounts.mint.key,
                &spl_token_2022::state::AccountState::Frozen,
            )?,
            &[ctx.accounts.mint.to_account_info()],
            &[config_seeds],
        )?;
    }

    // 5. Initialize metadata pointer — points to mint itself
    invoke_signed(
        &metadata_pointer_instruction::initialize(
            &TOKEN_2022_PROGRAM_ID,
            ctx.accounts.mint.key,
            Some(config_pubkey),
            Some(*ctx.accounts.mint.key),
        )?,
        &[ctx.accounts.mint.to_account_info()],
        &[config_seeds],
    )?;

    // 6. Initialize mint — config PDA as both mint_authority and freeze_authority
    invoke_signed(
        &token_instruction::initialize_mint2(
            &TOKEN_2022_PROGRAM_ID,
            ctx.accounts.mint.key,
            &config_pubkey,
            Some(&config_pubkey),
            params.decimals,
        )?,
        &[ctx.accounts.mint.to_account_info()],
        &[config_seeds],
    )?;

    // 7. Initialize metadata on the mint
    invoke_signed(
        &metadata_instruction::initialize(
            &TOKEN_2022_PROGRAM_ID,
            ctx.accounts.mint.key,
            &config_pubkey,
            ctx.accounts.mint.key,
            &config_pubkey,
            params.name,
            params.symbol,
            params.uri,
        ),
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.config.to_account_info(),
        ],
        &[config_seeds],
    )?;

    // Initialize config PDA
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.pending_authority = None;
    config.mint = ctx.accounts.mint.key();
    config.treasury = params.treasury;
    config.decimals = params.decimals;
    config.paused = false;
    config.enable_permanent_delegate = params.enable_permanent_delegate;
    config.enable_transfer_hook = params.enable_transfer_hook;
    config.default_account_frozen = params.default_account_frozen;
    config.transfer_hook_program = params.transfer_hook_program_id;
    config.total_minted = 0;
    config.total_burned = 0;
    config.bump = config_bump;
    config._reserved = [0u8; 64];

    let clock = Clock::get()?;
    emit!(InitializeEvent {
        authority: ctx.accounts.authority.key(),
        mint: ctx.accounts.mint.key(),
        treasury: params.treasury,
        decimals: params.decimals,
        enable_permanent_delegate: params.enable_permanent_delegate,
        enable_transfer_hook: params.enable_transfer_hook,
        default_account_frozen: params.default_account_frozen,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
