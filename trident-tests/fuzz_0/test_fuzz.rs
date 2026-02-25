use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod types;
use types::*;

const TOKEN_2022_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const CONFIG_SEED: &[u8] = b"config";
const MINTER_SEED: &[u8] = b"minter";
const ROLE_SEED: &[u8] = b"role";

fn find_config_pda(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED, mint.as_ref()], &sss_token::program_id())
}

fn find_minter_pda(config: &Pubkey, minter: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[MINTER_SEED, config.as_ref(), minter.as_ref()],
        &sss_token::program_id(),
    )
}

fn find_role_pda(config: &Pubkey, role_type: u8, address: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ROLE_SEED, config.as_ref(), &[role_type], address.as_ref()],
        &sss_token::program_id(),
    )
}

#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,
    // Stored keys — avoids AddressStorage borrow issues in flow methods
    authority_key: Pubkey,
    mint_key: Pubkey,
    config_key: Pubkey,
    // Invariant tracking
    total_minted: u64,
    total_burned: u64,
    minter_quota: u64,
    minter_remaining: u64,
    is_paused: bool,
    initialized: bool,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: AccountAddresses::default(),
            authority_key: Pubkey::default(),
            mint_key: Pubkey::default(),
            config_key: Pubkey::default(),
            total_minted: 0,
            total_burned: 0,
            minter_quota: 0,
            minter_remaining: 0,
            is_paused: false,
            initialized: false,
        }
    }

    #[init]
    fn start(&mut self) {
        let authority = self.trident.payer();
        let mint = self.trident.random_keypair();

        let (config_pda, _) = find_config_pda(&mint.pubkey());
        let (minter_role_pda, _) = find_role_pda(&config_pda, 0, &authority.pubkey());
        let (minter_pda, _) = find_minter_pda(&config_pda, &authority.pubkey());
        let (pauser_role_pda, _) = find_role_pda(&config_pda, 2, &authority.pubkey());
        let (burner_role_pda, _) = find_role_pda(&config_pda, 1, &authority.pubkey());

        self.authority_key = authority.pubkey();
        self.mint_key = mint.pubkey();
        self.config_key = config_pda;
        self.fuzz_accounts.authority.insert_with_address(authority.pubkey());
        self.fuzz_accounts.mint.insert_with_address(mint.pubkey());
        self.fuzz_accounts.config.insert_with_address(config_pda);

        // Initialize SSS-1 stablecoin
        let init_ix = sss_token::InitializeInstruction::data(
            sss_token::InitializeInstructionData::new(InitializeParams::new(
                "FuzzUSD".to_string(),
                "FUZD".to_string(),
                "".to_string(),
                6,
                false,
                false,
                false,
                None,
                authority.pubkey(),
            )),
        )
        .accounts(sss_token::InitializeInstructionAccounts::new(
            authority.pubkey(),
            config_pda,
            mint.pubkey(),
            TOKEN_2022_ID,
        ))
        .instruction();

        let res = self.trident.process_transaction(&[init_ix], Some("initialize"));
        if !res.is_success() {
            return;
        }
        self.initialized = true;

        // Add minter role
        let add_minter_role_ix = sss_token::UpdateRolesInstruction::data(
            sss_token::UpdateRolesInstructionData::new(
                authority.pubkey(),
                RoleType::Minter,
                RoleAction::Assign,
            ),
        )
        .accounts(sss_token::UpdateRolesInstructionAccounts::new(
            authority.pubkey(),
            config_pda,
            minter_role_pda,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[add_minter_role_ix], Some("add_minter_role"));

        // Add minter config with quota
        let quota = 1_000_000_000u64;
        let add_minter_ix = sss_token::UpdateMinterInstruction::data(
            sss_token::UpdateMinterInstructionData::new(
                authority.pubkey(),
                MinterAction::Add { quota },
            ),
        )
        .accounts(sss_token::UpdateMinterInstructionAccounts::new(
            authority.pubkey(),
            config_pda,
            minter_pda,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[add_minter_ix], Some("add_minter_config"));
        self.minter_quota = quota;
        self.minter_remaining = quota;

        // Add pauser role
        let add_pauser_ix = sss_token::UpdateRolesInstruction::data(
            sss_token::UpdateRolesInstructionData::new(
                authority.pubkey(),
                RoleType::Pauser,
                RoleAction::Assign,
            ),
        )
        .accounts(sss_token::UpdateRolesInstructionAccounts::new(
            authority.pubkey(),
            config_pda,
            pauser_role_pda,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[add_pauser_ix], Some("add_pauser_role"));

        // Add burner role
        let add_burner_ix = sss_token::UpdateRolesInstruction::data(
            sss_token::UpdateRolesInstructionData::new(
                authority.pubkey(),
                RoleType::Burner,
                RoleAction::Assign,
            ),
        )
        .accounts(sss_token::UpdateRolesInstructionAccounts::new(
            authority.pubkey(),
            config_pda,
            burner_role_pda,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[add_burner_ix], Some("add_burner_role"));

        self.total_minted = 0;
        self.total_burned = 0;
        self.is_paused = false;
    }

    /// Fuzz flow: mint random amount within quota
    #[flow]
    fn flow_mint(&mut self) {
        if !self.initialized || self.is_paused || self.minter_remaining == 0 {
            return;
        }

        let amount = self.trident.random_from_range(1u64..=self.minter_remaining.min(100_000_000));

        let authority = self.authority_key;
        let config = self.config_key;
        let mint = self.mint_key;
        let (minter_role_pda, _) = find_role_pda(&config, 0, &authority);
        let (minter_pda, _) = find_minter_pda(&config, &authority);

        let recipient_ata = self.trident.get_associated_token_address(
            &mint, &authority, &TOKEN_2022_ID,
        );

        let ix = sss_token::MintInstruction::data(sss_token::MintInstructionData::new(amount))
            .accounts(sss_token::MintInstructionAccounts::new(
                authority,
                config,
                minter_role_pda,
                minter_pda,
                mint,
                recipient_ata,
                TOKEN_2022_ID,
            ))
            .instruction();

        let res = self.trident.process_transaction(&[ix], Some("mint"));
        if res.is_success() {
            self.total_minted += amount;
            self.minter_remaining = self.minter_remaining.saturating_sub(amount);
        }
    }

    /// Fuzz flow: toggle pause/unpause
    #[flow]
    fn flow_pause_toggle(&mut self) {
        if !self.initialized {
            return;
        }

        let authority = self.authority_key;
        let config = self.config_key;
        let (pauser_role_pda, _) = find_role_pda(&config, 2, &authority);

        if self.is_paused {
            let ix = sss_token::UnpauseInstruction::data(sss_token::UnpauseInstructionData::new())
                .accounts(sss_token::UnpauseInstructionAccounts::new(
                    authority,
                    config,
                    pauser_role_pda,
                ))
                .instruction();

            if self.trident.process_transaction(&[ix], Some("unpause")).is_success() {
                self.is_paused = false;
            }
        } else {
            let ix = sss_token::PauseInstruction::data(sss_token::PauseInstructionData::new())
                .accounts(sss_token::PauseInstructionAccounts::new(
                    authority,
                    config,
                    pauser_role_pda,
                ))
                .instruction();

            if self.trident.process_transaction(&[ix], Some("pause")).is_success() {
                self.is_paused = true;
            }
        }
    }

    /// Fuzz flow: attempt unauthorized mint (must always fail)
    #[flow]
    fn flow_unauthorized_mint(&mut self) {
        if !self.initialized {
            return;
        }

        let rando = self.trident.random_keypair();
        let config = self.config_key;
        let mint = self.mint_key;
        let (fake_role, _) = find_role_pda(&config, 0, &rando.pubkey());
        let (fake_minter, _) = find_minter_pda(&config, &rando.pubkey());
        let recipient = self.trident.random_pubkey();

        let ix = sss_token::MintInstruction::data(sss_token::MintInstructionData::new(1_000_000))
            .accounts(sss_token::MintInstructionAccounts::new(
                rando.pubkey(),
                config,
                fake_role,
                fake_minter,
                mint,
                recipient,
                TOKEN_2022_ID,
            ))
            .instruction();

        let res = self.trident.process_transaction(&[ix], Some("unauthorized_mint"));
        assert!(
            !res.is_success(),
            "INVARIANT VIOLATION: unauthorized mint succeeded!"
        );
    }

    /// Fuzz flow: update minter quota with random value
    #[flow]
    fn flow_update_quota(&mut self) {
        if !self.initialized {
            return;
        }

        let new_quota = self.trident.random_from_range(1_000_000u64..=10_000_000_000u64);
        let authority = self.authority_key;
        let config = self.config_key;
        let (minter_pda, _) = find_minter_pda(&config, &authority);

        let ix = sss_token::UpdateMinterInstruction::data(
            sss_token::UpdateMinterInstructionData::new(
                authority,
                MinterAction::UpdateQuota { new_quota },
            ),
        )
        .accounts(sss_token::UpdateMinterInstructionAccounts::new(
            authority,
            config,
            minter_pda,
        ))
        .instruction();

        if self.trident.process_transaction(&[ix], Some("update_quota")).is_success() {
            self.minter_quota = new_quota;
            self.minter_remaining = new_quota;
            self.total_minted = 0;
        }
    }

    #[end]
    fn end(&mut self) {
        if !self.initialized {
            return;
        }

        // Invariant: total_minted >= total_burned
        assert!(
            self.total_minted >= self.total_burned,
            "SUPPLY INVARIANT: burned ({}) exceeds minted ({})",
            self.total_burned,
            self.total_minted
        );

        // Invariant: quota remaining <= quota total
        assert!(
            self.minter_remaining <= self.minter_quota,
            "QUOTA INVARIANT: remaining ({}) exceeds total ({})",
            self.minter_remaining,
            self.minter_quota
        );

        // Verify on-chain config state matches our tracking
        let config_account: Option<StablecoinConfig> =
            self.trident.get_account_with_type(&self.config_key, 8);

        if let Some(config) = config_account {
            assert_eq!(
                config.paused, self.is_paused,
                "PAUSE STATE INVARIANT: on-chain={} tracked={}",
                config.paused, self.is_paused
            );
        }
    }
}

fn main() {
    FuzzTest::fuzz(500, 50);
}
