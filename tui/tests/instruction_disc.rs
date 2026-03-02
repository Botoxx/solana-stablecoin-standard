use sha2::{Digest, Sha256};

fn expected_disc(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

#[test]
fn test_all_15_instruction_discriminators() {
    let instructions = [
        "initialize",
        "mint",
        "burn",
        "freeze_account",
        "thaw_account",
        "pause",
        "unpause",
        "update_minter",
        "update_roles",
        "propose_authority",
        "accept_authority",
        "add_to_blacklist",
        "remove_from_blacklist",
        "seize",
    ];

    for name in &instructions {
        let disc = sss_tui::instructions::instruction_discriminator(name);
        let expected = expected_disc(name);
        assert_eq!(
            disc, expected,
            "Discriminator mismatch for instruction: {name}"
        );
    }
}

#[test]
fn test_discriminators_are_unique() {
    let instructions = [
        "initialize",
        "mint",
        "burn",
        "freeze_account",
        "thaw_account",
        "pause",
        "unpause",
        "update_minter",
        "update_roles",
        "propose_authority",
        "accept_authority",
        "add_to_blacklist",
        "remove_from_blacklist",
        "seize",
    ];

    let discs: Vec<[u8; 8]> = instructions
        .iter()
        .map(|n| sss_tui::instructions::instruction_discriminator(n))
        .collect();

    for i in 0..discs.len() {
        for j in (i + 1)..discs.len() {
            assert_ne!(
                discs[i], discs[j],
                "Discriminator collision: {} vs {}",
                instructions[i], instructions[j]
            );
        }
    }
}

#[test]
fn test_discriminator_is_8_bytes() {
    let disc = sss_tui::instructions::instruction_discriminator("mint");
    assert_eq!(disc.len(), 8);
}
