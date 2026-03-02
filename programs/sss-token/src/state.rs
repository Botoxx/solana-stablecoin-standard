use anchor_lang::prelude::*;

/// Central configuration for a stablecoin instance.
///
/// **Design note (spec §3.1):** `name`, `symbol`, and `uri` are intentionally
/// stored in Token-2022's native MetadataPointer + TokenMetadata extensions
/// (the PYUSD pattern) rather than duplicated here. This avoids double rent
/// costs and eliminates a two-source-of-truth consistency problem. Query
/// metadata via `spl_token_metadata_interface` or the SDK's `getAccountInfo`.
#[account]
pub struct StablecoinConfig {
    pub authority: Pubkey,
    pub pending_authority: Option<Pubkey>,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub decimals: u8,
    pub paused: bool,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub transfer_hook_program: Option<Pubkey>,
    pub total_minted: u64,
    pub total_burned: u64,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

impl StablecoinConfig {
    pub const LEN: usize = 8  // discriminator
        + 32                   // authority
        + (1 + 32)            // pending_authority: Option<Pubkey>
        + 32                   // mint
        + 32                   // treasury
        + 1                    // decimals
        + 1                    // paused
        + 1                    // enable_permanent_delegate
        + 1                    // enable_transfer_hook
        + 1                    // default_account_frozen
        + (1 + 32)            // transfer_hook_program: Option<Pubkey>
        + 8                    // total_minted
        + 8                    // total_burned
        + 1                    // bump
        + 64; // _reserved
}

#[account]
pub struct MinterConfig {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub quota_total: u64,
    pub quota_remaining: u64,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

impl MinterConfig {
    pub const LEN: usize = 8  // discriminator
        + 32                   // config
        + 32                   // minter
        + 8                    // quota_total
        + 8                    // quota_remaining
        + 1                    // bump
        + 64; // _reserved
}

#[account]
pub struct RoleAssignment {
    pub config: Pubkey,
    pub role_type: u8,
    pub address: Pubkey,
    pub assigned_by: Pubkey,
    pub assigned_at: i64,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

impl RoleAssignment {
    pub const LEN: usize = 8  // discriminator
        + 32                   // config
        + 1                    // role_type
        + 32                   // address
        + 32                   // assigned_by
        + 8                    // assigned_at
        + 1                    // bump
        + 64; // _reserved
}

#[account]
pub struct BlacklistEntry {
    pub config: Pubkey,
    pub address: Pubkey,
    pub reason: String,
    pub blacklisted_at: i64,
    pub blacklisted_by: Pubkey,
    pub active: bool,
    pub bump: u8,
    pub _reserved: [u8; 64],
}

impl BlacklistEntry {
    pub const LEN: usize = 8  // discriminator
        + 32                   // config
        + 32                   // address
        + (4 + 128)           // reason: String (4 byte len prefix + max content)
        + 8                    // blacklisted_at
        + 32                   // blacklisted_by
        + 1                    // active
        + 1                    // bump
        + 64; // _reserved
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum RoleType {
    Minter = 0,
    Burner = 1,
    Pauser = 2,
    Blacklister = 3,
    Seizer = 4,
}

impl RoleType {
    pub fn to_u8(self) -> u8 {
        self as u8
    }

    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            0 => Some(RoleType::Minter),
            1 => Some(RoleType::Burner),
            2 => Some(RoleType::Pauser),
            3 => Some(RoleType::Blacklister),
            4 => Some(RoleType::Seizer),
            _ => None,
        }
    }
}
