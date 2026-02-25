use anchor_lang::prelude::*;
use anchor_lang::system_program;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_token_2022::extension::{
    BaseStateWithExtensions, StateWithExtensions,
    transfer_hook::TransferHookAccount,
};
use spl_token_2022::state::Account as TokenAccount;
use spl_transfer_hook_interface::instruction::TransferHookInstruction;

pub mod error;
use error::TransferHookError;

declare_id!("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "SSS Transfer Hook",
    project_url: "https://github.com/solanabr/solana-stablecoin-standard",
    contacts: "link:https://github.com/solanabr/solana-stablecoin-standard/issues",
    policy: "https://github.com/solanabr/solana-stablecoin-standard/blob/main/SECURITY.md",
    preferred_languages: "en,pt",
    source_code: "https://github.com/solanabr/solana-stablecoin-standard",
    auditors: "None"
}

/// Anchor discriminator for StablecoinConfig: sha256("account:StablecoinConfig")[..8]
const CONFIG_DISCRIMINATOR: [u8; 8] = [127, 25, 244, 213, 1, 192, 101, 6];

/// Anchor discriminator for BlacklistEntry: sha256("account:BlacklistEntry")[..8]
const BLACKLIST_DISCRIMINATOR: [u8; 8] = [218, 179, 231, 40, 141, 25, 168, 189];

/// Calculate the offset of the `paused` field in StablecoinConfig.
/// Borsh serializes Option<Pubkey> as 1 byte (None) or 1+32 bytes (Some),
/// so the offset varies depending on `pending_authority`.
fn get_paused_offset(config_data: &[u8]) -> Option<usize> {
    // Layout: disc(8) + authority(32) + Option<Pubkey> pending_authority + mint(32) + treasury(32) + decimals(1) + PAUSED
    const OPTION_TAG_OFFSET: usize = 8 + 32; // = 40
    if config_data.len() <= OPTION_TAG_OFFSET {
        return None;
    }
    let pending_auth_size = if config_data[OPTION_TAG_OFFSET] == 0 { 1 } else { 33 };
    let offset = 8 + 32 + pending_auth_size + 32 + 32 + 1;
    if config_data.len() > offset { Some(offset) } else { None }
}

/// Calculate the offset of the `active` field in BlacklistEntry.
/// Borsh serializes String as 4-byte length prefix + actual bytes (variable length),
/// so subsequent field offsets depend on the actual string content.
fn get_blacklist_active_offset(data: &[u8]) -> Option<usize> {
    // Layout: disc(8) + config(32) + address(32) + String reason + blacklisted_at(8) + blacklisted_by(32) + ACTIVE
    const REASON_LEN_OFFSET: usize = 8 + 32 + 32; // = 72
    if data.len() < REASON_LEN_OFFSET + 4 {
        return None;
    }
    let reason_len = u32::from_le_bytes([
        data[REASON_LEN_OFFSET],
        data[REASON_LEN_OFFSET + 1],
        data[REASON_LEN_OFFSET + 2],
        data[REASON_LEN_OFFSET + 3],
    ]) as usize;
    let offset = REASON_LEN_OFFSET + 4 + reason_len + 8 + 32;
    if data.len() > offset { Some(offset) } else { None }
}

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
        sss_token_program_id: Pubkey,
    ) -> Result<()> {
        // Validate config account is owned by the declared sss-token program,
        // preventing frontrun attacks where an attacker passes a fake program ID
        // with a config they control (which would disable blacklist enforcement).
        require!(
            *ctx.accounts.config.owner == sss_token_program_id,
            TransferHookError::InvalidConfig
        );

        let config_pda = ctx.accounts.config.key();

        // Define the extra account metas for the transfer hook
        let extra_metas = get_extra_account_metas(sss_token_program_id, config_pda)?;

        let account_size =
            ExtraAccountMetaList::size_of(extra_metas.len()).map_err(|_| TransferHookError::InvalidExtraAccountMetas)?;

        // Allocate space for the ExtraAccountMetaList
        let lamports = Rent::get()?.minimum_balance(account_size);
        let mint_key = ctx.accounts.mint.key();
        let bump = ctx.bumps.extra_account_meta_list;
        let seeds: &[&[u8]] = &[b"extra-account-metas", mint_key.as_ref(), &[bump]];

        system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
                &[seeds],
            ),
            lamports,
            account_size as u64,
            &crate::ID,
        )?;

        // Initialize the ExtraAccountMetaList
        let mut data = ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?;
        ExtraAccountMetaList::init::<spl_transfer_hook_interface::instruction::ExecuteInstruction>(&mut data, &extra_metas)?;

        Ok(())
    }

    pub fn transfer_hook(ctx: Context<ExecuteInstruction>, _amount: u64) -> Result<()> {
        // 1. Verify the source token account is currently transferring
        let source_account = &ctx.accounts.source_token;
        check_is_transferring(source_account)?;

        let sss_program_key = ctx.accounts.sss_token_program.key();

        // 2. Validate config account owner matches sss-token program
        require!(
            *ctx.accounts.config.owner == sss_program_key,
            TransferHookError::InvalidConfig
        );

        // 3. Check if system is paused — fail closed: reject transfer if config
        //    cannot be parsed (malformed data must not allow transfers through)
        let config_data = ctx.accounts.config.try_borrow_data()?;
        require!(
            config_data.len() >= 8 && config_data[..8] == CONFIG_DISCRIMINATOR,
            TransferHookError::InvalidConfig
        );
        let paused_offset = get_paused_offset(&config_data)
            .ok_or(error!(TransferHookError::InvalidConfig))?;
        require!(config_data[paused_offset] == 0, TransferHookError::Paused);
        drop(config_data);

        // 4. Check source blacklist
        check_blacklist(
            &ctx.accounts.source_blacklist_entry,
            &sss_program_key,
            TransferHookError::SenderBlacklisted,
        )?;

        // 5. Check dest blacklist
        check_blacklist(
            &ctx.accounts.dest_blacklist_entry,
            &sss_program_key,
            TransferHookError::RecipientBlacklisted,
        )?;

        Ok(())
    }

    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

fn check_is_transferring(account: &AccountInfo) -> Result<()> {
    if account.owner != &spl_token_2022::ID {
        return Err(TransferHookError::IsNotCurrentlyTransferring.into());
    }
    let data = account.try_borrow_data()?;
    let token_account = StateWithExtensions::<TokenAccount>::unpack(&data)
        .map_err(|_| error!(TransferHookError::IsNotCurrentlyTransferring))?;
    let hook_ext = token_account
        .get_extension::<TransferHookAccount>()
        .map_err(|_| error!(TransferHookError::IsNotCurrentlyTransferring))?;
    if !bool::from(hook_ext.transferring) {
        return Err(TransferHookError::IsNotCurrentlyTransferring.into());
    }
    Ok(())
}

fn check_blacklist(
    account: &AccountInfo,
    sss_program_id: &Pubkey,
    err: TransferHookError,
) -> Result<()> {
    // If the account has no data, the blacklist PDA was never created = not blacklisted
    if account.data_is_empty() {
        return Ok(());
    }

    // Fail closed: if the account exists but can't be validated as a legitimate
    // blacklist entry, reject the transfer. Only `data_is_empty()` (PDA never
    // created) is a valid "not blacklisted" signal. Wrong owner, bad discriminator,
    // or truncated data means the blacklist state is indeterminate — block rather
    // than allow a potentially sanctioned transfer through.
    require!(
        account.owner == sss_program_id,
        TransferHookError::InvalidBlacklist
    );

    let data = account.try_borrow_data()?;
    require!(
        data.len() >= 8 && data[..8] == BLACKLIST_DISCRIMINATOR,
        TransferHookError::InvalidBlacklist
    );

    let active_offset = get_blacklist_active_offset(&data)
        .ok_or(error!(TransferHookError::InvalidBlacklist))?;

    if data[active_offset] == 1 {
        return Err(err.into());
    }

    Ok(())
}

fn get_extra_account_metas(
    sss_token_program_id: Pubkey,
    config_pda: Pubkey,
) -> Result<Vec<ExtraAccountMeta>> {
    Ok(vec![
        // Index 5: sss-token program ID (for external PDA derivation)
        ExtraAccountMeta::new_with_pubkey(&sss_token_program_id, false, false)
            .map_err(|_| TransferHookError::InvalidExtraAccountMetas)?,
        // Index 6: StablecoinConfig PDA (read paused flag)
        ExtraAccountMeta::new_with_pubkey(&config_pda, false, false)
            .map_err(|_| TransferHookError::InvalidExtraAccountMetas)?,
        // Index 7: Source blacklist entry — external PDA from sss-token
        // Seeds: ["blacklist", config, source_owner]
        // source_owner is extracted from the source token account (index 0)
        // at offset 32 (after the 32-byte mint pubkey in Token-2022 layout).
        // We read from account data rather than using AccountKey{index:3}
        // because index 3 is the signer/delegate — not necessarily the token
        // account owner. A delegate transfer would check the delegate's
        // blacklist status instead of the actual token holder's.
        ExtraAccountMeta::new_external_pda_with_seeds(
            5, // sss-token program index
            &[
                Seed::Literal {
                    bytes: b"blacklist".to_vec(),
                },
                Seed::AccountKey { index: 6 }, // config PDA
                Seed::AccountData {
                    account_index: 0,
                    data_index: 32,
                    length: 32,
                }, // source owner from token account
            ],
            false, // is_signer
            false, // is_writable
        )
        .map_err(|_| TransferHookError::InvalidExtraAccountMetas)?,
        // Index 8: Dest blacklist entry — external PDA from sss-token
        // Seeds: ["blacklist", config, dest_owner]
        // dest_owner is extracted from the destination token account (index 2)
        // The owner field is at offset 32 in the token account data (after mint pubkey)
        ExtraAccountMeta::new_external_pda_with_seeds(
            5, // sss-token program index
            &[
                Seed::Literal {
                    bytes: b"blacklist".to_vec(),
                },
                Seed::AccountKey { index: 6 }, // config PDA
                Seed::AccountData {
                    account_index: 2,
                    data_index: 32,
                    length: 32,
                }, // dest owner from token account
            ],
            false,
            false,
        )
        .map_err(|_| TransferHookError::InvalidExtraAccountMetas)?,
    ])
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList PDA — validated by seeds + emptiness check
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
        constraint = extra_account_meta_list.data_is_empty() @ TransferHookError::InvalidExtraAccountMetas,
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    /// CHECK: The mint account — must be owned by Token-2022
    #[account(
        constraint = *mint.owner == spl_token_2022::ID @ TransferHookError::InvalidConfig,
    )]
    pub mint: AccountInfo<'info>,

    /// CHECK: StablecoinConfig from sss-token program — owner must match the
    /// sss_token_program_id passed as instruction data, preventing an attacker
    /// from frontrunning with a fake config pointing to a malicious program.
    pub config: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteInstruction<'info> {
    /// CHECK: Source token account
    pub source_token: AccountInfo<'info>,

    /// CHECK: Mint
    pub mint: AccountInfo<'info>,

    /// CHECK: Destination token account
    pub destination_token: AccountInfo<'info>,

    /// CHECK: Source token account owner/delegate
    pub owner: AccountInfo<'info>,

    /// CHECK: ExtraAccountMetaList PDA
    pub extra_account_meta_list: AccountInfo<'info>,

    // --- Extra accounts (indices 5-8) ---
    /// CHECK: sss-token program
    pub sss_token_program: AccountInfo<'info>,

    /// CHECK: StablecoinConfig PDA
    pub config: AccountInfo<'info>,

    /// CHECK: Source blacklist entry
    pub source_blacklist_entry: AccountInfo<'info>,

    /// CHECK: Destination blacklist entry
    pub dest_blacklist_entry: AccountInfo<'info>,
}
