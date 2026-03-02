use solana_sdk::pubkey::Pubkey;

/// Cross-check PDA derivation against known program IDs and seeds.
/// These test that our Rust PDA logic matches the TypeScript SDK.

fn program_id() -> Pubkey {
    "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1"
        .parse()
        .unwrap()
}

fn hook_program_id() -> Pubkey {
    "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj"
        .parse()
        .unwrap()
}

#[test]
fn test_config_pda_deterministic() {
    let mint = Pubkey::new_unique();
    let (pda1, bump1) = sss_tui::pda::config_pda(&mint);
    let (pda2, bump2) = sss_tui::pda::config_pda(&mint);
    assert_eq!(pda1, pda2);
    assert_eq!(bump1, bump2);

    // Verify it derives from the correct program
    let (expected, _) = Pubkey::find_program_address(&[b"config", mint.as_ref()], &program_id());
    assert_eq!(pda1, expected);
}

#[test]
fn test_minter_pda_deterministic() {
    let config = Pubkey::new_unique();
    let minter = Pubkey::new_unique();
    let (pda, _) = sss_tui::pda::minter_pda(&config, &minter);

    let (expected, _) = Pubkey::find_program_address(
        &[b"minter", config.as_ref(), minter.as_ref()],
        &program_id(),
    );
    assert_eq!(pda, expected);
}

#[test]
fn test_role_pda_deterministic() {
    let config = Pubkey::new_unique();
    let address = Pubkey::new_unique();
    for role_type in 0..5u8 {
        let (pda, _) = sss_tui::pda::role_pda(&config, role_type, &address);

        let (expected, _) = Pubkey::find_program_address(
            &[b"role", config.as_ref(), &[role_type], address.as_ref()],
            &program_id(),
        );
        assert_eq!(pda, expected, "role_type={role_type}");
    }
}

#[test]
fn test_blacklist_pda_deterministic() {
    let config = Pubkey::new_unique();
    let address = Pubkey::new_unique();
    let (pda, _) = sss_tui::pda::blacklist_pda(&config, &address);

    let (expected, _) = Pubkey::find_program_address(
        &[b"blacklist", config.as_ref(), address.as_ref()],
        &program_id(),
    );
    assert_eq!(pda, expected);
}

#[test]
fn test_extra_account_metas_pda_deterministic() {
    let mint = Pubkey::new_unique();
    let (pda, _) = sss_tui::pda::extra_account_metas_pda(&mint);

    let (expected, _) =
        Pubkey::find_program_address(&[b"extra-account-metas", mint.as_ref()], &hook_program_id());
    assert_eq!(pda, expected);
}

#[test]
fn test_ata_derivation() {
    let owner = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let ata = sss_tui::pda::get_ata(&owner, &mint);

    let token_2022 = sss_tui::pda::TOKEN_2022_PROGRAM_ID;
    let ata_program = sss_tui::pda::ASSOCIATED_TOKEN_PROGRAM_ID;

    let (expected, _) = Pubkey::find_program_address(
        &[owner.as_ref(), token_2022.as_ref(), mint.as_ref()],
        &ata_program,
    );
    assert_eq!(ata, expected);
}

#[test]
fn test_different_inputs_produce_different_pdas() {
    let mint1 = Pubkey::new_unique();
    let mint2 = Pubkey::new_unique();
    let (pda1, _) = sss_tui::pda::config_pda(&mint1);
    let (pda2, _) = sss_tui::pda::config_pda(&mint2);
    assert_ne!(pda1, pda2);
}
