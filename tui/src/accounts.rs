use borsh::BorshDeserialize;
use sha2::{Digest, Sha256};
use solana_sdk::pubkey::Pubkey;

/// Compute Anchor account discriminator: sha256("account:{Name}")[..8]
fn account_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("account:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

pub fn stablecoin_config_disc() -> [u8; 8] {
    account_discriminator("StablecoinConfig")
}

pub fn minter_config_disc() -> [u8; 8] {
    account_discriminator("MinterConfig")
}

pub fn role_assignment_disc() -> [u8; 8] {
    account_discriminator("RoleAssignment")
}

pub fn blacklist_entry_disc() -> [u8; 8] {
    account_discriminator("BlacklistEntry")
}

/// StablecoinConfig — matches programs/sss-token/src/state.rs field order exactly.
#[derive(Debug, Clone)]
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
}

impl StablecoinConfig {
    pub fn current_supply(&self) -> u64 {
        self.total_minted.saturating_sub(self.total_burned)
    }
}

#[derive(Debug, Clone)]
pub struct MinterConfig {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub quota_total: u64,
    pub quota_remaining: u64,
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct RoleAssignment {
    pub config: Pubkey,
    pub role_type: u8,
    pub address: Pubkey,
    pub assigned_by: Pubkey,
    pub assigned_at: i64,
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct BlacklistEntry {
    pub config: Pubkey,
    pub address: Pubkey,
    pub reason: String,
    pub blacklisted_at: i64,
    pub blacklisted_by: Pubkey,
    pub active: bool,
    pub bump: u8,
}

pub fn role_name(role_type: u8) -> &'static str {
    match role_type {
        0 => "Minter",
        1 => "Burner",
        2 => "Pauser",
        3 => "Blacklister",
        4 => "Seizer",
        _ => "Unknown",
    }
}

fn check_disc(data: &[u8], expected: [u8; 8]) -> Option<&[u8]> {
    if data.len() < 8 || data[..8] != expected {
        return None;
    }
    Some(&data[8..])
}

pub fn parse_stablecoin_config(data: &[u8]) -> Option<StablecoinConfig> {
    let mut buf = check_disc(data, stablecoin_config_disc())?;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let pending_authority = Option::<Pubkey>::deserialize(&mut buf).ok()?;
    let mint = Pubkey::deserialize(&mut buf).ok()?;
    let treasury = Pubkey::deserialize(&mut buf).ok()?;
    let decimals = u8::deserialize(&mut buf).ok()?;
    let paused = bool::deserialize(&mut buf).ok()?;
    let enable_permanent_delegate = bool::deserialize(&mut buf).ok()?;
    let enable_transfer_hook = bool::deserialize(&mut buf).ok()?;
    let default_account_frozen = bool::deserialize(&mut buf).ok()?;
    let transfer_hook_program = Option::<Pubkey>::deserialize(&mut buf).ok()?;
    let total_minted = u64::deserialize(&mut buf).ok()?;
    let total_burned = u64::deserialize(&mut buf).ok()?;
    let bump = u8::deserialize(&mut buf).ok()?;
    Some(StablecoinConfig {
        authority,
        pending_authority,
        mint,
        treasury,
        decimals,
        paused,
        enable_permanent_delegate,
        enable_transfer_hook,
        default_account_frozen,
        transfer_hook_program,
        total_minted,
        total_burned,
        bump,
    })
}

pub fn parse_minter_config(data: &[u8]) -> Option<MinterConfig> {
    let mut buf = check_disc(data, minter_config_disc())?;
    let config = Pubkey::deserialize(&mut buf).ok()?;
    let minter = Pubkey::deserialize(&mut buf).ok()?;
    let quota_total = u64::deserialize(&mut buf).ok()?;
    let quota_remaining = u64::deserialize(&mut buf).ok()?;
    let bump = u8::deserialize(&mut buf).ok()?;
    Some(MinterConfig {
        config,
        minter,
        quota_total,
        quota_remaining,
        bump,
    })
}

pub fn parse_role_assignment(data: &[u8]) -> Option<RoleAssignment> {
    let mut buf = check_disc(data, role_assignment_disc())?;
    let config = Pubkey::deserialize(&mut buf).ok()?;
    let role_type = u8::deserialize(&mut buf).ok()?;
    let address = Pubkey::deserialize(&mut buf).ok()?;
    let assigned_by = Pubkey::deserialize(&mut buf).ok()?;
    let assigned_at = i64::deserialize(&mut buf).ok()?;
    let bump = u8::deserialize(&mut buf).ok()?;
    Some(RoleAssignment {
        config,
        role_type,
        address,
        assigned_by,
        assigned_at,
        bump,
    })
}

pub fn parse_blacklist_entry(data: &[u8]) -> Option<BlacklistEntry> {
    let mut buf = check_disc(data, blacklist_entry_disc())?;
    let config = Pubkey::deserialize(&mut buf).ok()?;
    let address = Pubkey::deserialize(&mut buf).ok()?;
    let reason = String::deserialize(&mut buf).ok()?;
    let blacklisted_at = i64::deserialize(&mut buf).ok()?;
    let blacklisted_by = Pubkey::deserialize(&mut buf).ok()?;
    let active = bool::deserialize(&mut buf).ok()?;
    let bump = u8::deserialize(&mut buf).ok()?;
    Some(BlacklistEntry {
        config,
        address,
        reason,
        blacklisted_at,
        blacklisted_by,
        active,
        bump,
    })
}
