use thiserror::Error;

#[derive(Error, Debug)]
pub enum TuiError {
    #[error("RPC error: {0}")]
    Rpc(#[from] solana_client::client_error::ClientError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Borsh error: {0}")]
    Borsh(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Invalid pubkey: {0}")]
    Pubkey(String),

    #[error("{0}")]
    Custom(String),
}

pub type Result<T> = std::result::Result<T, TuiError>;

/// Map error codes to human-readable messages.
/// Covers Anchor framework errors (2000-3999) and SSS custom errors (6000-6023).
pub fn error_message(code: u32) -> &'static str {
    match code {
        // Anchor constraint errors
        2001 => "Account constraint violated: not mutable",
        2003 => "Account constraint violated",
        2006 => "PDA seed constraint failed — account doesn't exist or wrong derivation",
        2011 => "Account constraint: not a signer",
        2012 => "Account address mismatch",
        // Anchor account errors
        3001 => "Account discriminator not found — account may not exist",
        3002 => "Account discriminator mismatch — wrong account type",
        3003 => "Account failed to deserialize — may not be initialized",
        3007 => "Account owned by wrong program",
        3012 => "Account not initialized — required role or config PDA missing",
        // SSS custom errors (6000-6023)
        6000 => "Unauthorized: you don't have the required role",
        6001 => "System is paused",
        6002 => "System is not paused",
        6003 => "Sender is blacklisted",
        6004 => "Recipient is blacklisted",
        6005 => "Account must be frozen before seizure",
        6006 => "Invalid treasury address",
        6007 => "Minter quota exceeded",
        6008 => "Blacklist reason is required",
        6009 => "Compliance features not enabled",
        6010 => "Address is already blacklisted",
        6011 => "Address is not blacklisted",
        6012 => "Invalid role type",
        6013 => "Authority mismatch",
        6014 => "Pending authority mismatch",
        6015 => "No pending authority transfer",
        6016 => "Minter already configured",
        6017 => "Minter not found",
        6018 => "Amount must be greater than zero",
        6019 => "String length exceeds maximum",
        6020 => "Arithmetic overflow",
        6021 => "Mint does not match config",
        6022 => "Blacklist reason too long",
        6023 => "Role already assigned",
        _ => "Unknown program error",
    }
}

/// Parse an Anchor program error from transaction logs.
/// Returns (error_code, human_message) if found.
pub fn parse_tx_error(logs: &[String]) -> Option<(u32, &'static str)> {
    for log in logs.iter().rev() {
        if let Some(hex_start) = log.find("custom program error: 0x") {
            let hex_str = &log[hex_start + 24..];
            let hex_end = hex_str
                .find(|c: char| !c.is_ascii_hexdigit())
                .unwrap_or(hex_str.len());
            if let Ok(code) = u32::from_str_radix(&hex_str[..hex_end], 16) {
                return Some((code, error_message(code)));
            }
        }
    }
    None
}
