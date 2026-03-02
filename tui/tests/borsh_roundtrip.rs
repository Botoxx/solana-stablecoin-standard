use borsh::BorshSerialize;
use sha2::{Digest, Sha256};
use solana_sdk::pubkey::Pubkey;

fn account_disc(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("account:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

fn make_pubkey(seed: u8) -> Pubkey {
    Pubkey::new_from_array([seed; 32])
}

/// Build raw account data for StablecoinConfig matching the on-chain Borsh layout.
fn build_config_data() -> Vec<u8> {
    let mut data = account_disc("StablecoinConfig").to_vec();
    // authority: Pubkey
    make_pubkey(1).serialize(&mut data).unwrap();
    // pending_authority: Option<Pubkey> = None
    0u8.serialize(&mut data).unwrap(); // None variant
                                       // mint: Pubkey
    make_pubkey(2).serialize(&mut data).unwrap();
    // treasury: Pubkey
    make_pubkey(3).serialize(&mut data).unwrap();
    // decimals: u8
    6u8.serialize(&mut data).unwrap();
    // paused: bool
    false.serialize(&mut data).unwrap();
    // enable_permanent_delegate: bool
    true.serialize(&mut data).unwrap();
    // enable_transfer_hook: bool
    true.serialize(&mut data).unwrap();
    // default_account_frozen: bool
    false.serialize(&mut data).unwrap();
    // transfer_hook_program: Option<Pubkey> = Some
    1u8.serialize(&mut data).unwrap();
    make_pubkey(4).serialize(&mut data).unwrap();
    // total_minted: u64
    1_000_000u64.serialize(&mut data).unwrap();
    // total_burned: u64
    50_000u64.serialize(&mut data).unwrap();
    // bump: u8
    255u8.serialize(&mut data).unwrap();
    // _reserved: [u8; 64]
    data.extend_from_slice(&[0u8; 64]);
    data
}

#[test]
fn test_stablecoin_config_roundtrip() {
    let data = build_config_data();
    let config = sss_tui::accounts::parse_stablecoin_config(&data).expect("parse config");
    assert_eq!(config.authority, make_pubkey(1));
    assert_eq!(config.pending_authority, None);
    assert_eq!(config.mint, make_pubkey(2));
    assert_eq!(config.treasury, make_pubkey(3));
    assert_eq!(config.decimals, 6);
    assert!(!config.paused);
    assert!(config.enable_permanent_delegate);
    assert!(config.enable_transfer_hook);
    assert!(!config.default_account_frozen);
    assert_eq!(config.transfer_hook_program, Some(make_pubkey(4)));
    assert_eq!(config.total_minted, 1_000_000);
    assert_eq!(config.total_burned, 50_000);
    assert_eq!(config.bump, 255);
    assert_eq!(config.current_supply(), 950_000);
}

#[test]
fn test_minter_config_roundtrip() {
    let mut data = account_disc("MinterConfig").to_vec();
    make_pubkey(10).serialize(&mut data).unwrap(); // config
    make_pubkey(11).serialize(&mut data).unwrap(); // minter
    500_000u64.serialize(&mut data).unwrap(); // quota_total
    300_000u64.serialize(&mut data).unwrap(); // quota_remaining
    254u8.serialize(&mut data).unwrap(); // bump
    data.extend_from_slice(&[0u8; 64]); // _reserved

    let minter = sss_tui::accounts::parse_minter_config(&data).expect("parse minter");
    assert_eq!(minter.config, make_pubkey(10));
    assert_eq!(minter.minter, make_pubkey(11));
    assert_eq!(minter.quota_total, 500_000);
    assert_eq!(minter.quota_remaining, 300_000);
    assert_eq!(minter.bump, 254);
}

#[test]
fn test_role_assignment_roundtrip() {
    let mut data = account_disc("RoleAssignment").to_vec();
    make_pubkey(20).serialize(&mut data).unwrap(); // config
    2u8.serialize(&mut data).unwrap(); // role_type (Pauser)
    make_pubkey(21).serialize(&mut data).unwrap(); // address
    make_pubkey(22).serialize(&mut data).unwrap(); // assigned_by
    1700000000i64.serialize(&mut data).unwrap(); // assigned_at
    253u8.serialize(&mut data).unwrap(); // bump
    data.extend_from_slice(&[0u8; 64]); // _reserved

    let role = sss_tui::accounts::parse_role_assignment(&data).expect("parse role");
    assert_eq!(role.config, make_pubkey(20));
    assert_eq!(role.role_type, 2);
    assert_eq!(role.address, make_pubkey(21));
    assert_eq!(role.assigned_by, make_pubkey(22));
    assert_eq!(role.assigned_at, 1700000000);
    assert_eq!(role.bump, 253);
}

#[test]
fn test_blacklist_entry_roundtrip() {
    let mut data = account_disc("BlacklistEntry").to_vec();
    make_pubkey(30).serialize(&mut data).unwrap(); // config
    make_pubkey(31).serialize(&mut data).unwrap(); // address
    "OFAC sanctioned".to_string().serialize(&mut data).unwrap(); // reason
    1700000001i64.serialize(&mut data).unwrap(); // blacklisted_at
    make_pubkey(32).serialize(&mut data).unwrap(); // blacklisted_by
    true.serialize(&mut data).unwrap(); // active
    252u8.serialize(&mut data).unwrap(); // bump
    data.extend_from_slice(&[0u8; 64]); // _reserved

    let entry = sss_tui::accounts::parse_blacklist_entry(&data).expect("parse blacklist");
    assert_eq!(entry.config, make_pubkey(30));
    assert_eq!(entry.address, make_pubkey(31));
    assert_eq!(entry.reason, "OFAC sanctioned");
    assert_eq!(entry.blacklisted_at, 1700000001);
    assert_eq!(entry.blacklisted_by, make_pubkey(32));
    assert!(entry.active);
    assert_eq!(entry.bump, 252);
}

#[test]
fn test_wrong_discriminator_returns_none() {
    let mut data = [0u8; 200].to_vec();
    data[0..8].copy_from_slice(&[0xFF; 8]); // Wrong discriminator
    assert!(sss_tui::accounts::parse_stablecoin_config(&data).is_none());
    assert!(sss_tui::accounts::parse_minter_config(&data).is_none());
    assert!(sss_tui::accounts::parse_role_assignment(&data).is_none());
    assert!(sss_tui::accounts::parse_blacklist_entry(&data).is_none());
}
