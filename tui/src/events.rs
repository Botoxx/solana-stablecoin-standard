use borsh::BorshDeserialize;
use sha2::{Digest, Sha256};
use solana_sdk::pubkey::Pubkey;
use std::collections::HashMap;

/// Compute Anchor event discriminator: sha256("event:{Name}")[..8]
fn event_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("event:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

/// Parsed event data for display.
#[derive(Debug, Clone)]
pub struct EventData {
    pub name: String,
    pub authority: String,
    pub timestamp: i64,
    pub fields: Vec<(String, String)>,
    pub tx_sig: Option<String>,
}

impl EventData {
    pub fn color_category(&self) -> EventColor {
        match self.name.as_str() {
            "Initialize" | "AuthorityProposed" | "AuthorityAccepted" => EventColor::Cyan,
            "Mint" | "Unpause" | "Thaw" => EventColor::Green,
            "Burn" | "Pause" | "Freeze" | "Seize" => EventColor::Red,
            "BlacklistAdd" | "BlacklistRemove" => EventColor::Yellow,
            "RoleUpdated" | "MinterUpdated" => EventColor::Blue,
            _ => EventColor::Default,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventColor {
    Green,
    Red,
    Yellow,
    Blue,
    Cyan,
    Default,
}

type DecoderFn = fn(&[u8]) -> Option<EventData>;

pub fn build_event_map() -> HashMap<[u8; 8], DecoderFn> {
    let mut map: HashMap<[u8; 8], DecoderFn> = HashMap::new();
    map.insert(event_discriminator("InitializeEvent"), decode_initialize);
    map.insert(event_discriminator("MintEvent"), decode_mint);
    map.insert(event_discriminator("BurnEvent"), decode_burn);
    map.insert(event_discriminator("FreezeEvent"), decode_freeze);
    map.insert(event_discriminator("ThawEvent"), decode_thaw);
    map.insert(event_discriminator("PauseEvent"), decode_pause);
    map.insert(event_discriminator("UnpauseEvent"), decode_unpause);
    map.insert(
        event_discriminator("MinterUpdatedEvent"),
        decode_minter_updated,
    );
    map.insert(event_discriminator("RoleUpdatedEvent"), decode_role_updated);
    map.insert(
        event_discriminator("AuthorityProposedEvent"),
        decode_authority_proposed,
    );
    map.insert(
        event_discriminator("AuthorityAcceptedEvent"),
        decode_authority_accepted,
    );
    map.insert(
        event_discriminator("BlacklistAddEvent"),
        decode_blacklist_add,
    );
    map.insert(
        event_discriminator("BlacklistRemoveEvent"),
        decode_blacklist_remove,
    );
    map.insert(event_discriminator("SeizeEvent"), decode_seize);
    map
}

pub fn parse_event(data: &[u8], event_map: &HashMap<[u8; 8], DecoderFn>) -> Option<EventData> {
    if data.len() < 8 {
        return None;
    }
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&data[..8]);
    let decoder = event_map.get(&disc)?;
    decoder(&data[8..])
}

fn short(pk: &Pubkey) -> String {
    let s = pk.to_string();
    if s.len() > 8 {
        format!("{}..{}", &s[..4], &s[s.len() - 4..])
    } else {
        s
    }
}

fn decode_initialize(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let mint = Pubkey::deserialize(&mut buf).ok()?;
    let treasury = Pubkey::deserialize(&mut buf).ok()?;
    let decimals = u8::deserialize(&mut buf).ok()?;
    let enable_pd = bool::deserialize(&mut buf).ok()?;
    let enable_th = bool::deserialize(&mut buf).ok()?;
    let default_frozen = bool::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Initialize".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("mint".into(), short(&mint)),
            ("treasury".into(), short(&treasury)),
            ("decimals".into(), decimals.to_string()),
            ("permanent_delegate".into(), enable_pd.to_string()),
            ("transfer_hook".into(), enable_th.to_string()),
            ("default_frozen".into(), default_frozen.to_string()),
        ],
        tx_sig: None,
    })
}

fn decode_mint(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let minter = Pubkey::deserialize(&mut buf).ok()?;
    let recipient = Pubkey::deserialize(&mut buf).ok()?;
    let amount = u64::deserialize(&mut buf).ok()?;
    let remaining = u64::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Mint".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("minter".into(), short(&minter)),
            ("recipient".into(), short(&recipient)),
            ("amount".into(), amount.to_string()),
            ("quota_remaining".into(), remaining.to_string()),
        ],
        tx_sig: None,
    })
}

fn decode_burn(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let burner = Pubkey::deserialize(&mut buf).ok()?;
    let amount = u64::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Burn".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("burner".into(), short(&burner)),
            ("amount".into(), amount.to_string()),
        ],
        tx_sig: None,
    })
}

fn decode_freeze(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let account = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Freeze".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![("account".into(), short(&account))],
        tx_sig: None,
    })
}

fn decode_thaw(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let account = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Thaw".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![("account".into(), short(&account))],
        tx_sig: None,
    })
}

fn decode_pause(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Pause".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![],
        tx_sig: None,
    })
}

fn decode_unpause(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Unpause".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![],
        tx_sig: None,
    })
}

fn decode_minter_updated(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let minter = Pubkey::deserialize(&mut buf).ok()?;
    let quota_total = u64::deserialize(&mut buf).ok()?;
    let quota_remaining = u64::deserialize(&mut buf).ok()?;
    let action = String::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "MinterUpdated".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("minter".into(), short(&minter)),
            ("action".into(), action),
            ("quota_total".into(), quota_total.to_string()),
            ("quota_remaining".into(), quota_remaining.to_string()),
        ],
        tx_sig: None,
    })
}

fn decode_role_updated(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let address = Pubkey::deserialize(&mut buf).ok()?;
    let role = u8::deserialize(&mut buf).ok()?;
    let action = String::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "RoleUpdated".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("address".into(), short(&address)),
            ("role".into(), crate::accounts::role_name(role).to_string()),
            ("action".into(), action),
        ],
        tx_sig: None,
    })
}

fn decode_authority_proposed(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let proposed = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "AuthorityProposed".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![("proposed".into(), short(&proposed))],
        tx_sig: None,
    })
}

fn decode_authority_accepted(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let old_authority = Pubkey::deserialize(&mut buf).ok()?;
    let new_authority = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "AuthorityAccepted".into(),
        authority: short(&old_authority),
        timestamp,
        fields: vec![("new_authority".into(), short(&new_authority))],
        tx_sig: None,
    })
}

fn decode_blacklist_add(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let address = Pubkey::deserialize(&mut buf).ok()?;
    let reason = String::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "BlacklistAdd".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("address".into(), short(&address)),
            ("reason".into(), reason),
        ],
        tx_sig: None,
    })
}

fn decode_blacklist_remove(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let address = Pubkey::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "BlacklistRemove".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![("address".into(), short(&address))],
        tx_sig: None,
    })
}

fn decode_seize(data: &[u8]) -> Option<EventData> {
    let mut buf = data;
    let authority = Pubkey::deserialize(&mut buf).ok()?;
    let source = Pubkey::deserialize(&mut buf).ok()?;
    let treasury = Pubkey::deserialize(&mut buf).ok()?;
    let amount = u64::deserialize(&mut buf).ok()?;
    let timestamp = i64::deserialize(&mut buf).ok()?;
    Some(EventData {
        name: "Seize".into(),
        authority: short(&authority),
        timestamp,
        fields: vec![
            ("source".into(), short(&source)),
            ("treasury".into(), short(&treasury)),
            ("amount".into(), amount.to_string()),
        ],
        tx_sig: None,
    })
}
