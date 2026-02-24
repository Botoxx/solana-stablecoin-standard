use anchor_lang::prelude::*;

#[error_code]
pub enum TransferHookError {
    #[msg("Sender is blacklisted")]
    SenderBlacklisted,
    #[msg("Recipient is blacklisted")]
    RecipientBlacklisted,
    #[msg("System is paused")]
    Paused,
    #[msg("Token is not currently transferring — direct hook invocation rejected")]
    IsNotCurrentlyTransferring,
    #[msg("Invalid extra account metas")]
    InvalidExtraAccountMetas,
}
