use borsh::BorshSerialize;
use sha2::{Digest, Sha256};
use solana_sdk::pubkey::Pubkey;

fn event_disc(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("event:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

fn make_pubkey(seed: u8) -> Pubkey {
    Pubkey::new_from_array([seed; 32])
}

fn build_event(name: &str, serialize_fn: impl FnOnce(&mut Vec<u8>)) -> Vec<u8> {
    let mut data = event_disc(name).to_vec();
    serialize_fn(&mut data);
    data
}

#[test]
fn test_parse_initialize_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("InitializeEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap(); // authority
        make_pubkey(2).serialize(buf).unwrap(); // mint
        make_pubkey(3).serialize(buf).unwrap(); // treasury
        6u8.serialize(buf).unwrap(); // decimals
        true.serialize(buf).unwrap(); // enable_pd
        true.serialize(buf).unwrap(); // enable_th
        false.serialize(buf).unwrap(); // default_frozen
        1700000000i64.serialize(buf).unwrap(); // timestamp
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Initialize");
    assert_eq!(event.timestamp, 1700000000);
}

#[test]
fn test_parse_mint_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("MintEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        make_pubkey(3).serialize(buf).unwrap();
        1000u64.serialize(buf).unwrap();
        500u64.serialize(buf).unwrap();
        1700000001i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Mint");
    assert!(event
        .fields
        .iter()
        .any(|(k, v)| k == "amount" && v == "1000"));
}

#[test]
fn test_parse_burn_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("BurnEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        5000u64.serialize(buf).unwrap();
        1700000002i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Burn");
}

#[test]
fn test_parse_freeze_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("FreezeEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        1700000003i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Freeze");
}

#[test]
fn test_parse_thaw_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("ThawEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        1700000004i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Thaw");
}

#[test]
fn test_parse_pause_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("PauseEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        1700000005i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Pause");
}

#[test]
fn test_parse_unpause_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("UnpauseEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        1700000006i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Unpause");
}

#[test]
fn test_parse_minter_updated_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("MinterUpdatedEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        100000u64.serialize(buf).unwrap();
        100000u64.serialize(buf).unwrap();
        "Add".to_string().serialize(buf).unwrap();
        1700000007i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "MinterUpdated");
    assert!(event
        .fields
        .iter()
        .any(|(k, v)| k == "action" && v == "Add"));
}

#[test]
fn test_parse_role_updated_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("RoleUpdatedEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        2u8.serialize(buf).unwrap();
        "Assign".to_string().serialize(buf).unwrap();
        1700000008i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "RoleUpdated");
    assert!(event.fields.iter().any(|(k, _)| k == "role"));
}

#[test]
fn test_parse_authority_proposed_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("AuthorityProposedEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        1700000009i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "AuthorityProposed");
}

#[test]
fn test_parse_authority_accepted_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("AuthorityAcceptedEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        1700000010i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "AuthorityAccepted");
}

#[test]
fn test_parse_blacklist_add_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("BlacklistAddEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        "OFAC".to_string().serialize(buf).unwrap();
        1700000011i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "BlacklistAdd");
}

#[test]
fn test_parse_blacklist_remove_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("BlacklistRemoveEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        1700000012i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "BlacklistRemove");
}

#[test]
fn test_parse_seize_event() {
    let event_map = sss_tui::events::build_event_map();
    let data = build_event("SeizeEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        make_pubkey(3).serialize(buf).unwrap();
        99999u64.serialize(buf).unwrap();
        1700000013i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&data, &event_map).expect("parse");
    assert_eq!(event.name, "Seize");
    assert!(event
        .fields
        .iter()
        .any(|(k, v)| k == "amount" && v == "99999"));
}

#[test]
fn test_unknown_discriminator_returns_none() {
    let event_map = sss_tui::events::build_event_map();
    let data = vec![0xFF; 32];
    assert!(sss_tui::events::parse_event(&data, &event_map).is_none());
}

#[test]
fn test_too_short_returns_none() {
    let event_map = sss_tui::events::build_event_map();
    assert!(sss_tui::events::parse_event(&[1, 2, 3], &event_map).is_none());
}

#[test]
fn test_event_color_categories() {
    let event_map = sss_tui::events::build_event_map();
    let mint_data = build_event("MintEvent", |buf| {
        make_pubkey(1).serialize(buf).unwrap();
        make_pubkey(2).serialize(buf).unwrap();
        make_pubkey(3).serialize(buf).unwrap();
        1000u64.serialize(buf).unwrap();
        500u64.serialize(buf).unwrap();
        1700000000i64.serialize(buf).unwrap();
    });

    let event = sss_tui::events::parse_event(&mint_data, &event_map).unwrap();
    assert_eq!(event.color_category(), sss_tui::events::EventColor::Green);
}
