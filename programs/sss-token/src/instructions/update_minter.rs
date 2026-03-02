use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::SssError;
use crate::events::MinterUpdatedEvent;
use crate::state::{MinterConfig, StablecoinConfig};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum MinterAction {
    Add { quota: u64 },
    UpdateQuota { new_quota: u64 },
    Remove,
}

#[derive(Accounts)]
#[instruction(minter_address: Pubkey, action: MinterAction)]
pub struct UpdateMinter<'info> {
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
        space = MinterConfig::LEN,
        seeds = [MINTER_SEED, config.key().as_ref(), minter_address.as_ref()],
        bump,
    )]
    pub minter_config: Account<'info, MinterConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UpdateMinter>,
    minter_address: Pubkey,
    action: MinterAction,
) -> Result<()> {
    let minter_config = &mut ctx.accounts.minter_config;
    let config_key = ctx.accounts.config.key();
    let clock = Clock::get()?;

    let (action_str, quota_total, quota_remaining) = match action {
        MinterAction::Add { quota } => {
            require!(quota > 0, SssError::InvalidAmount);
            // For init_if_needed: check it's not already set up
            // If config field is default (all zeros), it's a new account
            if minter_config.config != Pubkey::default() {
                return Err(SssError::MinterAlreadyConfigured.into());
            }
            minter_config.config = config_key;
            minter_config.minter = minter_address;
            minter_config.quota_total = quota;
            minter_config.quota_remaining = quota;
            minter_config.bump = ctx.bumps.minter_config;
            ("add".to_string(), quota, quota)
        }
        MinterAction::UpdateQuota { new_quota } => {
            require!(new_quota > 0, SssError::InvalidAmount);
            require!(minter_config.config == config_key, SssError::MinterNotFound);
            minter_config.quota_total = new_quota;
            minter_config.quota_remaining = new_quota;
            ("update".to_string(), new_quota, new_quota)
        }
        MinterAction::Remove => {
            require!(minter_config.config == config_key, SssError::MinterNotFound);
            // Close the account — return lamports to authority and zero all data
            // to prevent stale fields from interfering with future re-add operations
            let dest = ctx.accounts.authority.to_account_info();
            let source = minter_config.to_account_info();
            let dest_lamports = dest.lamports();
            **dest.try_borrow_mut_lamports()? = dest_lamports
                .checked_add(source.lamports())
                .ok_or(SssError::Overflow)?;
            **source.try_borrow_mut_lamports()? = 0;
            let mut data = source.try_borrow_mut_data()?;
            data.fill(0);
            ("remove".to_string(), 0u64, 0u64)
        }
    };

    emit!(MinterUpdatedEvent {
        authority: ctx.accounts.authority.key(),
        minter: minter_address,
        quota_total,
        quota_remaining,
        action: action_str,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
