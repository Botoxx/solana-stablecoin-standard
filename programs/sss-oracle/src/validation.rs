use anchor_lang::prelude::*;

use crate::constants::{CONFIG_DISCRIMINATOR, SSS_TOKEN_PROGRAM_ID};
use crate::error::OracleError;

/// Extract the authority pubkey from a raw StablecoinConfig account.
/// Fail-closed: any parse failure returns InvalidConfigAccount.
///
/// Layout: discriminator(8) + authority(32) + ...
pub fn read_config_authority(account: &AccountInfo) -> Result<Pubkey> {
    require!(
        *account.owner == SSS_TOKEN_PROGRAM_ID,
        OracleError::InvalidConfigAccount
    );

    let data = account.try_borrow_data()?;

    require!(data.len() >= 40, OracleError::InvalidConfigAccount);
    require!(
        data[..8] == CONFIG_DISCRIMINATOR,
        OracleError::InvalidConfigAccount
    );

    let mut authority_bytes = [0u8; 32];
    authority_bytes.copy_from_slice(&data[8..40]);
    Ok(Pubkey::new_from_array(authority_bytes))
}
