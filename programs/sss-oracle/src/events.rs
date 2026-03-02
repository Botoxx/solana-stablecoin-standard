use anchor_lang::prelude::*;

#[event]
pub struct FeedInitializedEvent {
    pub config: Pubkey,
    pub authority: Pubkey,
    pub feed_pda: Pubkey,
    pub pair: String,
    pub feed_type: u8,
    pub timestamp: i64,
}

#[event]
pub struct FeedConfigUpdatedEvent {
    pub feed_pda: Pubkey,
    pub authority: Pubkey,
    pub field_changed: String,
    pub timestamp: i64,
}

#[event]
pub struct PriceCachedEvent {
    pub feed_pda: Pubkey,
    pub pair: String,
    pub price: u64,
    pub slot: u64,
    pub timestamp: i64,
}

#[event]
pub struct ManualPriceSetEvent {
    pub feed_pda: Pubkey,
    pub authority: Pubkey,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeedClosedEvent {
    pub feed_pda: Pubkey,
    pub authority: Pubkey,
    pub pair: String,
    pub timestamp: i64,
}
