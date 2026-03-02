use solana_account_decoder::UiAccountEncoding;
use solana_client::{
    nonblocking::rpc_client::RpcClient,
    rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig, RpcSimulateTransactionConfig},
    rpc_filter::{Memcmp, RpcFilterType},
};
use solana_sdk::{
    commitment_config::CommitmentConfig, instruction::Instruction, pubkey::Pubkey,
    signer::keypair::Keypair, signer::Signer, transaction::Transaction,
};
use std::sync::Arc;

use crate::accounts;
use crate::event::RpcData;
use crate::pda;

/// Token holder info parsed from Token-2022 account data.
#[derive(Debug, Clone)]
pub struct HolderInfo {
    pub owner: Pubkey,
    pub balance: u64,
    pub frozen: bool,
}

#[derive(Clone)]
pub struct SolanaRpc {
    client: Arc<RpcClient>,
}

impl SolanaRpc {
    pub fn new(url: &str) -> Self {
        Self {
            client: Arc::new(RpcClient::new_with_commitment(
                url.to_string(),
                CommitmentConfig::confirmed(),
            )),
        }
    }

    /// Fetch raw account data. Returns Ok(None) if account doesn't exist,
    /// Err if RPC fails for other reasons (network, rate limit, etc.).
    pub async fn fetch_account_data(&self, pubkey: &Pubkey) -> Result<Option<Vec<u8>>, String> {
        match self.client.get_account_data(pubkey).await {
            Ok(data) => Ok(Some(data)),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("AccountNotFound") || msg.contains("could not find") {
                    Ok(None)
                } else {
                    Err(format!("RPC error fetching {pubkey}: {msg}"))
                }
            }
        }
    }

    pub async fn fetch_config(
        &self,
        config_pda: &Pubkey,
    ) -> Result<Option<accounts::StablecoinConfig>, String> {
        let data = self.fetch_account_data(config_pda).await?;
        match data {
            None => Ok(None),
            Some(d) => match accounts::parse_stablecoin_config(&d) {
                Some(cfg) => Ok(Some(cfg)),
                None => Err(format!(
                    "Config account {config_pda} exists ({} bytes) but failed to parse — possible schema mismatch",
                    d.len()
                )),
            },
        }
    }

    /// Fetch all MinterConfig accounts filtered by config PDA.
    pub async fn fetch_all_minters(
        &self,
        config_pda: &Pubkey,
    ) -> Result<(Vec<accounts::MinterConfig>, usize), String> {
        let disc = accounts::minter_config_disc();
        let filters = vec![
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(0, disc.to_vec())),
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(8, config_pda.to_bytes().to_vec())),
        ];
        self.fetch_program_accounts_parsed(
            pda::SSS_TOKEN_PROGRAM_ID,
            filters,
            accounts::parse_minter_config,
        )
        .await
    }

    /// Fetch all RoleAssignment accounts filtered by config PDA.
    pub async fn fetch_all_roles(
        &self,
        config_pda: &Pubkey,
    ) -> Result<(Vec<accounts::RoleAssignment>, usize), String> {
        let disc = accounts::role_assignment_disc();
        let filters = vec![
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(0, disc.to_vec())),
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(8, config_pda.to_bytes().to_vec())),
        ];
        self.fetch_program_accounts_parsed(
            pda::SSS_TOKEN_PROGRAM_ID,
            filters,
            accounts::parse_role_assignment,
        )
        .await
    }

    /// Fetch all BlacklistEntry accounts filtered by config PDA.
    pub async fn fetch_all_blacklist(
        &self,
        config_pda: &Pubkey,
    ) -> Result<(Vec<accounts::BlacklistEntry>, usize), String> {
        let disc = accounts::blacklist_entry_disc();
        let filters = vec![
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(0, disc.to_vec())),
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(8, config_pda.to_bytes().to_vec())),
        ];
        self.fetch_program_accounts_parsed(
            pda::SSS_TOKEN_PROGRAM_ID,
            filters,
            accounts::parse_blacklist_entry,
        )
        .await
    }

    /// Fetch all token holders for a given mint (Token-2022).
    /// Parses mint(0..32), owner(32..64), amount(64..72), state(108) from raw account data.
    /// No dataSize filter — Token-2022 accounts with extensions are larger than 165 bytes.
    pub async fn fetch_holders(&self, mint: &Pubkey) -> Result<(Vec<HolderInfo>, usize), String> {
        let filters = vec![
            RpcFilterType::Memcmp(Memcmp::new_raw_bytes(0, mint.to_bytes().to_vec())),
        ];

        let config = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                commitment: Some(CommitmentConfig::confirmed()),
                ..Default::default()
            },
            ..Default::default()
        };

        let accounts = self
            .client
            .get_program_accounts_with_config(&pda::TOKEN_2022_PROGRAM_ID, config)
            .await
            .map_err(|e| format!("RPC error fetching holders: {e}"))?;

        let mut results = Vec::new();
        let mut failures = 0usize;
        for (_, acct) in accounts {
            match parse_holder_from_data(&acct.data) {
                Some(h) => results.push(h),
                None => failures += 1,
            }
        }
        Ok((results, failures))
    }

    /// Fetch token supply from the mint account.
    pub async fn fetch_supply(&self, mint: &Pubkey) -> Result<Option<u64>, String> {
        let data = self.fetch_account_data(mint).await?;
        Ok(data.and_then(|d| parse_supply_from_data(&d)))
    }

    /// Fetch token name and symbol from Token-2022 metadata extension.
    pub async fn fetch_token_metadata(
        &self,
        mint: &Pubkey,
    ) -> Result<(Option<String>, Option<String>), String> {
        let data = match self.fetch_account_data(mint).await? {
            Some(d) => d,
            None => return Ok((None, None)),
        };
        Ok(parse_token_metadata(&data))
    }

    /// Send and confirm a transaction with one or more instructions.
    pub async fn send_and_confirm(
        &self,
        ixs: &[Instruction],
        signer: &Keypair,
    ) -> std::result::Result<String, String> {
        let signer_pk = signer.pubkey();

        let recent_blockhash = self
            .client
            .get_latest_blockhash()
            .await
            .map_err(|e| format!("Blockhash: {e}"))?;

        let tx = Transaction::new_signed_with_payer(
            ixs,
            Some(&signer_pk),
            &[signer],
            recent_blockhash,
        );

        // Simulate first to get detailed logs on failure
        let sim_config = RpcSimulateTransactionConfig {
            sig_verify: false,
            commitment: Some(CommitmentConfig::confirmed()),
            ..Default::default()
        };
        let sim = self
            .client
            .simulate_transaction_with_config(&tx, sim_config)
            .await;

        match &sim {
            Ok(resp) => {
                if let Some(ref err) = resp.value.err {
                    let err_str = format!("{err:?}");
                    let logs = resp
                        .value
                        .logs
                        .as_ref()
                        .map(|l| l.join("\n"))
                        .unwrap_or_default();

                    // Try custom program error from simulation error
                    if let Some(hex_start) = err_str.find("Custom(") {
                        let after = &err_str[hex_start + 7..];
                        if let Some(end) = after.find(')') {
                            if let Ok(code) = after[..end].parse::<u32>() {
                                return Err(crate::error::error_message(code).to_string());
                            }
                        }
                    }

                    // For AccountNotFound, fetch signer balance for diagnostics
                    if err_str.contains("AccountNotFound") {
                        let signer_balance = self
                            .client
                            .get_balance(&signer_pk)
                            .await
                            .map(|b| format!("{b}"))
                            .unwrap_or_else(|_| "unknown".into());
                        let signer_short = crate::theme::truncate_pubkey(
                            &signer_pk.to_string(),
                            4,
                        );
                        return Err(format!(
                            "AccountNotFound — signer: {signer_short} (balance: {signer_balance} lamports). Logs: {}",
                            if logs.is_empty() { "none".to_string() } else { logs }
                        ));
                    }

                    let detail = if logs.is_empty() {
                        err_str
                    } else {
                        let last_log = logs
                            .lines()
                            .rev()
                            .find(|l| l.contains("Error") || l.contains("failed"))
                            .unwrap_or(&err_str);
                        last_log.to_string()
                    };
                    return Err(detail);
                }
            }
            Err(e) => {
                // Simulation RPC call itself failed — do NOT send blind
                return Err(format!(
                    "Pre-flight simulation failed: {e}. Transaction not sent — press 'r' to refresh and retry."
                ));
            }
        }

        // Simulation passed (or was skipped) — send for real
        match self.client.send_and_confirm_transaction(&tx).await {
            Ok(sig) => Ok(sig.to_string()),
            Err(e) => {
                let msg = e.to_string();
                if let Some(hex_start) = msg.find("custom program error: 0x") {
                    let hex_str = &msg[hex_start + 24..];
                    let hex_end = hex_str
                        .find(|c: char| !c.is_ascii_hexdigit())
                        .unwrap_or(hex_str.len());
                    if let Ok(code) = u32::from_str_radix(&hex_str[..hex_end], 16) {
                        return Err(crate::error::error_message(code).to_string());
                    }
                }
                Err(msg)
            }
        }
    }

    /// Returns (parsed_items, parse_failure_count). Parse failures are accounts that
    /// matched the RPC filters but couldn't be deserialized — possibly a schema mismatch.
    async fn fetch_program_accounts_parsed<T, F>(
        &self,
        program_id: Pubkey,
        filters: Vec<RpcFilterType>,
        parser: F,
    ) -> Result<(Vec<T>, usize), String>
    where
        F: Fn(&[u8]) -> Option<T>,
    {
        let config = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                commitment: Some(CommitmentConfig::confirmed()),
                ..Default::default()
            },
            ..Default::default()
        };

        let accounts = self
            .client
            .get_program_accounts_with_config(&program_id, config)
            .await
            .map_err(|e| format!("RPC error: {e}"))?;

        let mut results = Vec::new();
        let mut failures = 0usize;
        for (_, acct) in accounts {
            match parser(&acct.data) {
                Some(parsed) => results.push(parsed),
                None => failures += 1,
            }
        }
        Ok((results, failures))
    }
}

/// Parse raw Token-2022 token account data into HolderInfo.
/// Layout: mint(0..32), owner(32..64), amount(64..72 LE), ..., state(108).
/// state: 0=uninitialized, 1=initialized, 2=frozen.
pub fn parse_holder_from_data(data: &[u8]) -> Option<HolderInfo> {
    if data.len() < 109 {
        return None;
    }
    let owner = Pubkey::try_from(&data[32..64]).ok()?;
    let amount = u64::from_le_bytes(data[64..72].try_into().ok()?);
    let state = data[108];
    if state == 0 {
        return None;
    }
    Some(HolderInfo {
        owner,
        balance: amount,
        frozen: state == 2,
    })
}

/// Parse supply (u64 LE) from raw Token-2022 mint account data at offset 36..44.
pub fn parse_supply_from_data(data: &[u8]) -> Option<u64> {
    if data.len() < 44 {
        return None;
    }
    Some(u64::from_le_bytes(data[36..44].try_into().ok()?))
}

/// Parse Token-2022 metadata (name + symbol) from TLV extension data in mint account.
///
/// Token-2022 layout for Mint with extensions:
///   [0..82]   Mint base data
///   [82..165] Padding (zeros) to Account::LEN
///   [165]     AccountType (1=Mint)
///   [166..]   TLV extension entries
///
/// Each TLV: type(2 LE) + length(2 LE) + data.
/// TokenMetadata = ExtensionType 19. MetadataPointer = 18 (different!).
/// Within TokenMetadata: update_authority(32) + mint(32) + name(4+len) + symbol(4+len) + uri(4+len)
pub fn parse_token_metadata(data: &[u8]) -> (Option<String>, Option<String>) {
    // Need at least: 165 (padded base) + 1 (AccountType) + 4 (one TLV header)
    if data.len() < 170 {
        return (None, None);
    }

    let mut pos = 166; // skip 165-byte padded base + 1-byte AccountType
    while pos + 4 <= data.len() {
        let ext_type = u16::from_le_bytes([data[pos], data[pos + 1]]);
        let ext_len = u16::from_le_bytes([data[pos + 2], data[pos + 3]]) as usize;
        pos += 4;

        if ext_type == 0 && ext_len == 0 {
            break; // end sentinel
        }

        if ext_type == 19 && pos + ext_len <= data.len() {
            // TokenMetadata: update_authority(32) + mint(32) + name + symbol + uri
            let md = &data[pos..pos + ext_len];
            if md.len() < 68 {
                return (None, None);
            }
            let mut cursor = 64; // skip update_authority + mint
            let name = read_borsh_string(md, &mut cursor);
            let symbol = read_borsh_string(md, &mut cursor);
            return (name, symbol);
        }

        pos += ext_len;
    }
    (None, None)
}

fn read_borsh_string(data: &[u8], cursor: &mut usize) -> Option<String> {
    if *cursor + 4 > data.len() {
        return None;
    }
    let len = u32::from_le_bytes(data[*cursor..*cursor + 4].try_into().ok()?) as usize;
    *cursor += 4;
    if *cursor + len > data.len() {
        return None;
    }
    let s = String::from_utf8(data[*cursor..*cursor + len].to_vec()).ok()?;
    *cursor += len;
    Some(s)
}

/// Fetch all data for a config PDA in one pass.
/// Collects non-fatal RPC errors in `fetch_errors` instead of silently returning empty lists.
pub async fn fetch_all_data(rpc: &SolanaRpc, config_pda: &Pubkey) -> RpcData {
    let mut data = RpcData::default();

    // Fetch config first to get mint
    match rpc.fetch_config(config_pda).await {
        Ok(cfg) => data.config = cfg,
        Err(e) => {
            data.fetch_errors.push(format!("Config: {e}"));
            return data;
        }
    }

    if let Some(ref cfg) = data.config {
        let mint = cfg.mint;

        // Fetch everything in parallel
        let (minters, roles, blacklist, holders, supply, metadata) = tokio::join!(
            rpc.fetch_all_minters(config_pda),
            rpc.fetch_all_roles(config_pda),
            rpc.fetch_all_blacklist(config_pda),
            rpc.fetch_holders(&mint),
            rpc.fetch_supply(&mint),
            rpc.fetch_token_metadata(&mint),
        );

        match minters {
            Ok((v, f)) => {
                data.minters = v;
                if f > 0 { data.fetch_errors.push(format!("Minters: {f} account(s) failed to parse")); }
            }
            Err(e) => data.fetch_errors.push(format!("Minters: {e}")),
        }
        match roles {
            Ok((v, f)) => {
                data.roles = v;
                if f > 0 { data.fetch_errors.push(format!("Roles: {f} account(s) failed to parse")); }
            }
            Err(e) => data.fetch_errors.push(format!("Roles: {e}")),
        }
        match blacklist {
            Ok((v, f)) => {
                data.blacklist = v;
                if f > 0 { data.fetch_errors.push(format!("Blacklist: {f} account(s) failed to parse — possible schema change")); }
            }
            Err(e) => data.fetch_errors.push(format!("Blacklist: {e}")),
        }
        match holders {
            Ok((v, _)) => data.holders = v, // uninitialized token accounts are expected parse "failures"
            // getProgramAccounts for Token-2022 is disabled on most public RPC nodes
            // (secondary index exclusion). This is expected — holders tab just stays empty.
            Err(e) if e.contains("secondary indexes") || e.contains("excluded from account") => {}
            Err(e) => data.fetch_errors.push(format!("Holders: {e}")),
        }
        match supply {
            Ok(v) => data.supply = v,
            Err(e) => data.fetch_errors.push(format!("Supply: {e}")),
        }
        match metadata {
            Ok((name, symbol)) => {
                data.token_name = name;
                data.token_symbol = symbol;
            }
            Err(e) => data.fetch_errors.push(format!("Metadata: {e}")),
        }
    }

    data
}
