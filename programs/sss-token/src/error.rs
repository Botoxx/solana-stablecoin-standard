use anchor_lang::prelude::*;

#[error_code]
pub enum SssError {
    #[msg("Unauthorized: caller does not have the required role")]
    Unauthorized,
    #[msg("System is paused")]
    Paused,
    #[msg("System is not paused")]
    NotPaused,
    #[msg("Sender is blacklisted")]
    SenderBlacklisted,
    #[msg("Recipient is blacklisted")]
    RecipientBlacklisted,
    #[msg("Account is not frozen — freeze before seize")]
    AccountNotFrozen,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
    #[msg("Minter quota exceeded")]
    QuotaExceeded,
    #[msg("Blacklist reason is required")]
    BlacklistReasonRequired,
    #[msg("Compliance features not enabled on this config")]
    ComplianceNotEnabled,
    #[msg("Address is already blacklisted")]
    AlreadyBlacklisted,
    #[msg("Address is not blacklisted")]
    NotBlacklisted,
    #[msg("Invalid role type")]
    InvalidRole,
    #[msg("Authority mismatch")]
    AuthorityMismatch,
    #[msg("Pending authority mismatch — only proposed authority can accept")]
    PendingAuthorityMismatch,
    #[msg("No pending authority transfer")]
    NoPendingAuthority,
    #[msg("Minter already configured")]
    MinterAlreadyConfigured,
    #[msg("Minter not found")]
    MinterNotFound,
    #[msg("Invalid amount — must be greater than zero")]
    InvalidAmount,
    #[msg("String length exceeds maximum")]
    InvalidStringLength,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Invalid mint — does not match config")]
    InvalidMint,
    #[msg("Blacklist reason exceeds maximum length")]
    BlacklistReasonTooLong,
    #[msg("Role already assigned — revoke first")]
    RoleAlreadyAssigned,
}
