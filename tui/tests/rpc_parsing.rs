use solana_sdk::pubkey::Pubkey;

use sss_tui::rpc::{parse_holder_from_data, parse_supply_from_data, parse_token_metadata};

/// Construct raw Token-2022 token account data.
/// Layout: mint(0..32) | owner(32..64) | amount(64..72 LE) | delegate(72..104) | state(108) | ...
fn build_token_account(owner: &Pubkey, amount: u64, state: u8) -> Vec<u8> {
    let mint = Pubkey::new_from_array([2; 32]);
    let mut data = vec![0u8; 165]; // standard Token account size

    // mint at offset 0
    data[0..32].copy_from_slice(&mint.to_bytes());
    // owner at offset 32
    data[32..64].copy_from_slice(&owner.to_bytes());
    // amount at offset 64 (u64 LE)
    data[64..72].copy_from_slice(&amount.to_le_bytes());
    // state at offset 108
    data[108] = state;

    data
}

#[test]
fn test_parse_holder_initialized() {
    let owner = Pubkey::new_from_array([10; 32]);
    let data = build_token_account(&owner, 1_000_000, 1);

    let holder = parse_holder_from_data(&data).expect("should parse");
    assert_eq!(holder.owner, owner);
    assert_eq!(holder.balance, 1_000_000);
    assert!(!holder.frozen);
}

#[test]
fn test_parse_holder_frozen() {
    let owner = Pubkey::new_from_array([11; 32]);
    let data = build_token_account(&owner, 500, 2); // state=2 is frozen

    let holder = parse_holder_from_data(&data).expect("should parse");
    assert_eq!(holder.owner, owner);
    assert_eq!(holder.balance, 500);
    assert!(holder.frozen);
}

#[test]
fn test_parse_holder_uninitialized_returns_none() {
    let owner = Pubkey::new_from_array([12; 32]);
    let data = build_token_account(&owner, 0, 0); // state=0 is uninitialized

    assert!(parse_holder_from_data(&data).is_none());
}

#[test]
fn test_parse_holder_too_short_returns_none() {
    let data = vec![0u8; 50]; // way too short (need 109)
    assert!(parse_holder_from_data(&data).is_none());
}

#[test]
fn test_parse_holder_exact_minimum_length() {
    // 109 bytes is the minimum (state at 108)
    let owner = Pubkey::new_from_array([13; 32]);
    let mut data = vec![0u8; 109];
    data[32..64].copy_from_slice(&owner.to_bytes());
    data[64..72].copy_from_slice(&42u64.to_le_bytes());
    data[108] = 1; // initialized

    let holder = parse_holder_from_data(&data).expect("should parse at min length");
    assert_eq!(holder.balance, 42);
}

#[test]
fn test_parse_holder_large_token_2022_account() {
    // Token-2022 accounts with extensions are larger than 165
    let owner = Pubkey::new_from_array([14; 32]);
    let mut data = vec![0u8; 300]; // extensions present
    data[32..64].copy_from_slice(&owner.to_bytes());
    data[64..72].copy_from_slice(&999_999u64.to_le_bytes());
    data[108] = 2; // frozen

    let holder = parse_holder_from_data(&data).expect("should parse extended account");
    assert_eq!(holder.balance, 999_999);
    assert!(holder.frozen);
}

// ---- Supply parsing ----

#[test]
fn test_parse_supply() {
    // Token-2022 mint: supply at offset 36..44 (u64 LE)
    let mut data = vec![0u8; 82]; // standard mint size
    let supply: u64 = 5_000_000;
    data[36..44].copy_from_slice(&supply.to_le_bytes());

    assert_eq!(parse_supply_from_data(&data), Some(5_000_000));
}

#[test]
fn test_parse_supply_too_short() {
    let data = vec![0u8; 30]; // too short
    assert!(parse_supply_from_data(&data).is_none());
}

#[test]
fn test_parse_supply_zero() {
    let mut data = vec![0u8; 82];
    data[36..44].copy_from_slice(&0u64.to_le_bytes());
    assert_eq!(parse_supply_from_data(&data), Some(0));
}

// ---- Token metadata TLV parsing ----

/// Build a fake mint account with TokenMetadata extension.
/// Layout: 82-byte mint base | 1-byte AccountType | TLV entries...
/// TLV: type(2 LE) | length(2 LE) | data
/// TokenMetadata (type=18): update_authority(32) | mint(32) | name(4+len) | symbol(4+len) | uri(4+len)
fn build_mint_with_metadata(name: &str, symbol: &str, uri: &str) -> Vec<u8> {
    let mut data = vec![0u8; 83]; // 82 mint base + 1 account type

    // Build metadata content
    let mut md = Vec::new();
    md.extend_from_slice(&[0u8; 32]); // update_authority
    md.extend_from_slice(&[0u8; 32]); // mint

    // Borsh string: 4-byte LE length + bytes
    md.extend_from_slice(&(name.len() as u32).to_le_bytes());
    md.extend_from_slice(name.as_bytes());
    md.extend_from_slice(&(symbol.len() as u32).to_le_bytes());
    md.extend_from_slice(symbol.as_bytes());
    md.extend_from_slice(&(uri.len() as u32).to_le_bytes());
    md.extend_from_slice(uri.as_bytes());

    // TLV header: type=18 (0x12, 0x00), length
    let ext_type: u16 = 18;
    let ext_len: u16 = md.len() as u16;
    data.extend_from_slice(&ext_type.to_le_bytes());
    data.extend_from_slice(&ext_len.to_le_bytes());
    data.extend_from_slice(&md);

    data
}

#[test]
fn test_parse_token_metadata_valid() {
    let data = build_mint_with_metadata("Test Stablecoin", "TSC", "https://example.com");
    let (name, symbol) = parse_token_metadata(&data);
    assert_eq!(name.as_deref(), Some("Test Stablecoin"));
    assert_eq!(symbol.as_deref(), Some("TSC"));
}

#[test]
fn test_parse_token_metadata_empty_strings() {
    let data = build_mint_with_metadata("", "", "");
    let (name, symbol) = parse_token_metadata(&data);
    assert_eq!(name.as_deref(), Some(""));
    assert_eq!(symbol.as_deref(), Some(""));
}

#[test]
fn test_parse_token_metadata_no_extension() {
    // Just the base mint, no TLV extensions
    let data = vec![0u8; 83];
    let (name, symbol) = parse_token_metadata(&data);
    assert!(name.is_none());
    assert!(symbol.is_none());
}

#[test]
fn test_parse_token_metadata_too_short() {
    let data = vec![0u8; 50]; // way too short
    let (name, symbol) = parse_token_metadata(&data);
    assert!(name.is_none());
    assert!(symbol.is_none());
}

#[test]
fn test_parse_token_metadata_wrong_extension_type() {
    let mut data = vec![0u8; 83];
    // TLV with type=99 (not metadata)
    let ext_type: u16 = 99;
    let ext_len: u16 = 100;
    data.extend_from_slice(&ext_type.to_le_bytes());
    data.extend_from_slice(&ext_len.to_le_bytes());
    data.extend_from_slice(&[0u8; 100]);

    let (name, symbol) = parse_token_metadata(&data);
    assert!(name.is_none());
    assert!(symbol.is_none());
}

#[test]
fn test_parse_token_metadata_skips_preceding_extensions() {
    let mut data = vec![0u8; 83];

    // First TLV: type=5 (some other extension), length=10
    data.extend_from_slice(&5u16.to_le_bytes());
    data.extend_from_slice(&10u16.to_le_bytes());
    data.extend_from_slice(&[0u8; 10]);

    // Second TLV: type=18 (metadata)
    let mut md = Vec::new();
    md.extend_from_slice(&[0u8; 64]); // update_authority + mint
    let name = "SkipTest";
    let symbol = "SKP";
    let uri = "";
    md.extend_from_slice(&(name.len() as u32).to_le_bytes());
    md.extend_from_slice(name.as_bytes());
    md.extend_from_slice(&(symbol.len() as u32).to_le_bytes());
    md.extend_from_slice(symbol.as_bytes());
    md.extend_from_slice(&(uri.len() as u32).to_le_bytes());
    md.extend_from_slice(uri.as_bytes());

    data.extend_from_slice(&18u16.to_le_bytes());
    data.extend_from_slice(&(md.len() as u16).to_le_bytes());
    data.extend_from_slice(&md);

    let (parsed_name, parsed_symbol) = parse_token_metadata(&data);
    assert_eq!(parsed_name.as_deref(), Some("SkipTest"));
    assert_eq!(parsed_symbol.as_deref(), Some("SKP"));
}
