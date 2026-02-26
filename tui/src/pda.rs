use solana_sdk::pubkey::Pubkey;

pub const SSS_TOKEN_PROGRAM_ID: Pubkey =
    solana_sdk::pubkey!("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1");

pub const TRANSFER_HOOK_PROGRAM_ID: Pubkey =
    solana_sdk::pubkey!("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");

pub const TOKEN_2022_PROGRAM_ID: Pubkey =
    solana_sdk::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

pub const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey =
    solana_sdk::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

pub const SYSTEM_PROGRAM_ID: Pubkey = solana_sdk::pubkey!("11111111111111111111111111111111");

const CONFIG_SEED: &[u8] = b"config";
const MINTER_SEED: &[u8] = b"minter";
const ROLE_SEED: &[u8] = b"role";
const BLACKLIST_SEED: &[u8] = b"blacklist";
const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

pub fn config_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED, mint.as_ref()], &SSS_TOKEN_PROGRAM_ID)
}

pub fn minter_pda(config: &Pubkey, minter: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[MINTER_SEED, config.as_ref(), minter.as_ref()],
        &SSS_TOKEN_PROGRAM_ID,
    )
}

pub fn role_pda(config: &Pubkey, role_type: u8, address: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ROLE_SEED, config.as_ref(), &[role_type], address.as_ref()],
        &SSS_TOKEN_PROGRAM_ID,
    )
}

pub fn blacklist_pda(config: &Pubkey, address: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[BLACKLIST_SEED, config.as_ref(), address.as_ref()],
        &SSS_TOKEN_PROGRAM_ID,
    )
}

pub fn extra_account_metas_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[EXTRA_ACCOUNT_METAS_SEED, mint.as_ref()],
        &TRANSFER_HOOK_PROGRAM_ID,
    )
}

/// Derive ATA address: seeds = ["", owner, TOKEN_2022, mint] under ATA program.
pub fn get_ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let (ata, _) = Pubkey::find_program_address(
        &[
            owner.as_ref(),
            TOKEN_2022_PROGRAM_ID.as_ref(),
            mint.as_ref(),
        ],
        &ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    ata
}
