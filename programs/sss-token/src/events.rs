use anchor_lang::prelude::*;

#[event]
pub struct InitializeEvent {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub decimals: u8,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub timestamp: i64,
}

#[event]
pub struct MintEvent {
    pub authority: Pubkey,
    pub minter: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub remaining_quota: u64,
    pub timestamp: i64,
}

#[event]
pub struct BurnEvent {
    pub authority: Pubkey,
    pub burner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct FreezeEvent {
    pub authority: Pubkey,
    pub account: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ThawEvent {
    pub authority: Pubkey,
    pub account: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PauseEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct UnpauseEvent {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct MinterUpdatedEvent {
    pub authority: Pubkey,
    pub minter: Pubkey,
    pub quota_total: u64,
    pub quota_remaining: u64,
    pub action: String,
    pub timestamp: i64,
}

#[event]
pub struct RoleUpdatedEvent {
    pub authority: Pubkey,
    pub address: Pubkey,
    pub role: u8,
    pub action: String,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityProposedEvent {
    pub authority: Pubkey,
    pub proposed: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AuthorityAcceptedEvent {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct BlacklistAddEvent {
    pub authority: Pubkey,
    pub address: Pubkey,
    pub reason: String,
    pub timestamp: i64,
}

#[event]
pub struct BlacklistRemoveEvent {
    pub authority: Pubkey,
    pub address: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SeizeEvent {
    pub authority: Pubkey,
    pub source: Pubkey,
    pub treasury: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
