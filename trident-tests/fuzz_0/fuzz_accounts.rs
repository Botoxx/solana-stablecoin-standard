use trident_fuzz::fuzzing::*;

/// Storage for all account addresses used in fuzz testing.
///
/// This struct serves as a centralized repository for account addresses,
/// enabling their reuse across different instruction flows and test scenarios.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct AccountAddresses {
    pub new_authority: AddressStorage,

    pub config: AddressStorage,

    pub blacklister: AddressStorage,

    pub role_assignment: AddressStorage,

    pub blacklist_entry: AddressStorage,

    pub system_program: AddressStorage,

    pub burner: AddressStorage,

    pub mint: AddressStorage,

    pub burner_token_account: AddressStorage,

    pub token_program: AddressStorage,

    pub authority: AddressStorage,

    pub token_account: AddressStorage,

    pub rent: AddressStorage,

    pub minter: AddressStorage,

    pub minter_config: AddressStorage,

    pub recipient_token_account: AddressStorage,

    pub pauser: AddressStorage,

    pub seizer: AddressStorage,

    pub source_token_account: AddressStorage,

    pub treasury_token_account: AddressStorage,

    pub payer: AddressStorage,

    pub extra_account_meta_list: AddressStorage,

    pub source_token: AddressStorage,

    pub destination_token: AddressStorage,

    pub owner: AddressStorage,

    pub sss_token_program: AddressStorage,

    pub source_blacklist_entry: AddressStorage,

    pub dest_blacklist_entry: AddressStorage,
}
