use anchor_lang::prelude::*;

#[error_code]
pub enum OracleError {
    #[msg("Caller is not the stablecoin authority")]
    InvalidAuthority,
    #[msg("Invalid StablecoinConfig account — wrong owner or discriminator")]
    InvalidConfigAccount,
    #[msg("Currency pair must not be empty")]
    InvalidPair,
    #[msg("Invalid feed type — must be 0 (Switchboard) or 1 (Manual)")]
    InvalidFeedType,
    #[msg("Price decimals exceeds maximum (18)")]
    InvalidDecimals,
    #[msg("Feed is disabled")]
    FeedDisabled,
    #[msg("Feed account does not match stored feed_account")]
    FeedAccountMismatch,
    #[msg("Feed account is not owned by Switchboard program")]
    InvalidFeedOwner,
    #[msg("Switchboard feed data is invalid or too short")]
    InvalidSwitchboardData,
    #[msg("Price is stale — exceeds max_staleness slots")]
    StalePrice,
    #[msg("Price confidence interval exceeds max_confidence")]
    ExcessiveConfidence,
    #[msg("Invalid price — must be greater than zero")]
    InvalidPrice,
    #[msg("Arithmetic overflow during price conversion")]
    Overflow,
}
