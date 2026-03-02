use borsh::BorshSerialize;
use sha2::{Digest, Sha256};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signer::keypair::Keypair,
    signer::Signer,
};

use crate::accounts::StablecoinConfig;
use crate::app::ConfirmAction;
use crate::error::{Result, TuiError};
use crate::pda;

/// Compute Anchor instruction discriminator: sha256("global:{name}")[..8]
pub fn instruction_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{name}"));
    let hash = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&hash[..8]);
    disc
}

fn parse_pubkey(s: &str) -> Result<Pubkey> {
    s.parse::<Pubkey>()
        .map_err(|_| TuiError::Pubkey(s.to_string()))
}

/// Build a create-ATA-idempotent instruction (won't fail if ATA already exists).
fn create_ata_idempotent_ix(funder: &Pubkey, owner: &Pubkey, mint: &Pubkey) -> Instruction {
    let ata = pda::get_ata(owner, mint);
    Instruction {
        program_id: pda::ASSOCIATED_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(*funder, true),                              // funding account
            AccountMeta::new(ata, false),                                 // associated token account
            AccountMeta::new_readonly(*owner, false),                     // wallet address
            AccountMeta::new_readonly(*mint, false),                      // token mint
            AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),     // system program
            AccountMeta::new_readonly(pda::TOKEN_2022_PROGRAM_ID, false), // token program
        ],
        data: vec![1], // 1 = CreateIdempotent
    }
}

/// Build instructions from a confirmed action.
/// Returns a Vec because some actions (Mint) need a preceding create-ATA instruction.
pub fn build_instructions(
    action: &ConfirmAction,
    config_pda: &Pubkey,
    config: &StablecoinConfig,
    keypair: &Keypair,
) -> Result<Vec<Instruction>> {
    let signer = keypair.pubkey();
    let mint = config.mint;

    match action {
        ConfirmAction::Mint { recipient, amount } => {
            let recipient_pk = parse_pubkey(recipient)?;
            let recipient_ata = pda::get_ata(&recipient_pk, &mint);
            let role_pda = pda::role_pda(config_pda, 0, &signer).0; // Minter=0
            let minter_pda = pda::minter_pda(config_pda, &signer).0;

            let mut data = instruction_discriminator("mint").to_vec();
            amount
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            let create_ata = create_ata_idempotent_ix(&signer, &recipient_pk, &mint);

            let mint_ix = Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),             // minter
                    AccountMeta::new(*config_pda, false),       // config
                    AccountMeta::new_readonly(role_pda, false), // role_assignment
                    AccountMeta::new(minter_pda, false),        // minter_config
                    AccountMeta::new(mint, false),              // mint
                    AccountMeta::new(recipient_ata, false),     // recipient_token_account
                    AccountMeta::new_readonly(pda::TOKEN_2022_PROGRAM_ID, false),
                ],
                data,
            };

            Ok(vec![create_ata, mint_ix])
        }

        ConfirmAction::Burn { source, amount } => {
            let source_wallet = match source {
                Some(s) => parse_pubkey(s)?,
                None => signer,
            };
            let source_ata = pda::get_ata(&source_wallet, &mint);
            let role_pda = pda::role_pda(config_pda, 1, &signer).0; // Burner=1

            let mut data = instruction_discriminator("burn").to_vec();
            amount
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),             // burner
                    AccountMeta::new(*config_pda, false),       // config
                    AccountMeta::new_readonly(role_pda, false), // role_assignment
                    AccountMeta::new(mint, false),              // mint
                    AccountMeta::new(source_ata, false),        // burner_token_account
                    AccountMeta::new_readonly(pda::TOKEN_2022_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::Freeze { wallet } => {
            let wallet_pk = parse_pubkey(wallet)?;
            let ata = pda::get_ata(&wallet_pk, &mint);

            let data = instruction_discriminator("freeze_account").to_vec();

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new_readonly(signer, true),       // authority
                    AccountMeta::new_readonly(*config_pda, false), // config
                    AccountMeta::new_readonly(mint, false),        // mint
                    AccountMeta::new(ata, false),                  // token_account
                    AccountMeta::new_readonly(pda::TOKEN_2022_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::Thaw { wallet } => {
            let wallet_pk = parse_pubkey(wallet)?;
            let ata = pda::get_ata(&wallet_pk, &mint);

            let data = instruction_discriminator("thaw_account").to_vec();

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new_readonly(signer, true),
                    AccountMeta::new_readonly(*config_pda, false),
                    AccountMeta::new_readonly(mint, false),
                    AccountMeta::new(ata, false),
                    AccountMeta::new_readonly(pda::TOKEN_2022_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::Pause => {
            let role_pda = pda::role_pda(config_pda, 2, &signer).0; // Pauser=2

            let data = instruction_discriminator("pause").to_vec();

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new_readonly(signer, true),    // pauser
                    AccountMeta::new(*config_pda, false),       // config
                    AccountMeta::new_readonly(role_pda, false), // role_assignment
                ],
                data,
            }])
        }

        ConfirmAction::Unpause => {
            let role_pda = pda::role_pda(config_pda, 2, &signer).0; // Pauser=2

            let data = instruction_discriminator("unpause").to_vec();

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new_readonly(signer, true),
                    AccountMeta::new(*config_pda, false),
                    AccountMeta::new_readonly(role_pda, false),
                ],
                data,
            }])
        }

        ConfirmAction::AssignRole { address, role_type } => {
            let addr = parse_pubkey(address)?;
            let role_pda = pda::role_pda(config_pda, *role_type, &addr).0;

            // update_roles(address: Pubkey, role: RoleType, action: RoleAction)
            // RoleType is u8, RoleAction::Assign = variant index 0
            let mut data = instruction_discriminator("update_roles").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            role_type
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            0u8.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?; // Assign=0

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),                // authority
                    AccountMeta::new_readonly(*config_pda, false), // config
                    AccountMeta::new(role_pda, false),             // role_assignment
                    AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::RevokeRole { address, role_type } => {
            let addr = parse_pubkey(address)?;
            let role_pda = pda::role_pda(config_pda, *role_type, &addr).0;

            let mut data = instruction_discriminator("update_roles").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            role_type
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            1u8.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?; // Revoke=1

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),
                    AccountMeta::new_readonly(*config_pda, false),
                    AccountMeta::new(role_pda, false),
                    AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::AddMinter { address, quota } => {
            let addr = parse_pubkey(address)?;
            let minter_pda = pda::minter_pda(config_pda, &addr).0;

            // update_minter(minter_address: Pubkey, action: MinterAction)
            // MinterAction::Add { quota } = variant 0 + u64
            let mut data = instruction_discriminator("update_minter").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            0u8.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?; // Add=0
            quota
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),
                    AccountMeta::new_readonly(*config_pda, false),
                    AccountMeta::new(minter_pda, false),
                    AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::UpdateQuota { address, new_quota } => {
            let addr = parse_pubkey(address)?;
            let minter_pda = pda::minter_pda(config_pda, &addr).0;

            // MinterAction::UpdateQuota { new_quota } = variant 1 + u64
            let mut data = instruction_discriminator("update_minter").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            1u8.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?; // UpdateQuota=1
            new_quota
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),
                    AccountMeta::new_readonly(*config_pda, false),
                    AccountMeta::new(minter_pda, false),
                    AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::RemoveMinter { address } => {
            let addr = parse_pubkey(address)?;
            let minter_pda = pda::minter_pda(config_pda, &addr).0;

            // MinterAction::Remove = variant 2
            let mut data = instruction_discriminator("update_minter").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            2u8.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?; // Remove=2

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),
                    AccountMeta::new_readonly(*config_pda, false),
                    AccountMeta::new(minter_pda, false),
                    AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::AddBlacklist { address, reason } => {
            let addr = parse_pubkey(address)?;
            let role_pda = pda::role_pda(config_pda, 3, &signer).0; // Blacklister=3
            let bl_pda = pda::blacklist_pda(config_pda, &addr).0;

            // add_to_blacklist(address: Pubkey, reason: String)
            let mut data = instruction_discriminator("add_to_blacklist").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;
            reason
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(signer, true),                // blacklister
                    AccountMeta::new_readonly(*config_pda, false), // config
                    AccountMeta::new_readonly(role_pda, false),    // role_assignment
                    AccountMeta::new(bl_pda, false),               // blacklist_entry
                    AccountMeta::new_readonly(pda::SYSTEM_PROGRAM_ID, false),
                ],
                data,
            }])
        }

        ConfirmAction::RemoveBlacklist { address } => {
            let addr = parse_pubkey(address)?;
            let role_pda = pda::role_pda(config_pda, 3, &signer).0;
            let bl_pda = pda::blacklist_pda(config_pda, &addr).0;

            // remove_from_blacklist(address: Pubkey)
            let mut data = instruction_discriminator("remove_from_blacklist").to_vec();
            addr.serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new_readonly(signer, true), // blacklister
                    AccountMeta::new_readonly(*config_pda, false),
                    AccountMeta::new_readonly(role_pda, false),
                    AccountMeta::new(bl_pda, false), // blacklist_entry
                ],
                data,
            }])
        }

        ConfirmAction::Seize { wallet, amount } => {
            let wallet_pk = parse_pubkey(wallet)?;
            let source_ata = pda::get_ata(&wallet_pk, &mint);
            let treasury_ata = pda::get_ata(&config.treasury, &mint);
            let role_pda = pda::role_pda(config_pda, 4, &signer).0; // Seizer=4

            let mut data = instruction_discriminator("seize").to_vec();
            amount
                .serialize(&mut data)
                .map_err(|e| TuiError::Borsh(e.to_string()))?;

            Ok(vec![Instruction {
                program_id: pda::SSS_TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new_readonly(signer, true),    // seizer
                    AccountMeta::new(*config_pda, false),       // config
                    AccountMeta::new_readonly(role_pda, false), // role_assignment
                    AccountMeta::new(mint, false),              // mint
                    AccountMeta::new(source_ata, false),        // source_token_account
                    AccountMeta::new(treasury_ata, false),      // treasury_token_account
                    AccountMeta::new_readonly(pda::TOKEN_2022_PROGRAM_ID, false),
                ],
                data,
            }])
        }
    }
}
