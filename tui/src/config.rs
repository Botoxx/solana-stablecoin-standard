use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::{Result, TuiError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TuiConfig {
    pub rpc_url: String,
    pub ws_url: String,
    pub keypair_path: String,
    pub config_pda: Option<String>,
    pub mint: Option<String>,
}

impl Default for TuiConfig {
    fn default() -> Self {
        Self {
            rpc_url: "https://api.devnet.solana.com".into(),
            ws_url: "wss://api.devnet.solana.com".into(),
            keypair_path: shellexpand("~/.config/solana/id.json"),
            config_pda: None,
            mint: None,
        }
    }
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("sss-tui")
}

fn config_path() -> PathBuf {
    config_dir().join("config.toml")
}

fn shellexpand(p: &str) -> String {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest).to_string_lossy().into_owned();
        }
    }
    p.to_string()
}

impl TuiConfig {
    pub fn load() -> Result<Self> {
        let path = config_path();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| TuiError::Config(format!("read {}: {}", path.display(), e)))?;
        toml::from_str(&content)
            .map_err(|e| TuiError::Config(format!("parse {}: {}", path.display(), e)))
    }

    pub fn save(&self) -> Result<()> {
        let dir = config_dir();
        std::fs::create_dir_all(&dir)
            .map_err(|e| TuiError::Config(format!("mkdir {}: {}", dir.display(), e)))?;

        let content = toml::to_string_pretty(self)
            .map_err(|e| TuiError::Config(format!("serialize: {}", e)))?;

        let tmp = config_dir().join("config.toml.tmp");
        let path = config_path();
        std::fs::write(&tmp, &content)
            .map_err(|e| TuiError::Config(format!("write {}: {}", tmp.display(), e)))?;
        std::fs::rename(&tmp, &path)
            .map_err(|e| TuiError::Config(format!("rename to {}: {}", path.display(), e)))?;

        Ok(())
    }

    pub fn apply_overrides(
        &mut self,
        rpc_url: Option<String>,
        ws_url: Option<String>,
        keypair: Option<String>,
        config_pda: Option<String>,
    ) {
        if let Some(url) = rpc_url {
            self.rpc_url = url;
        }
        if let Some(url) = ws_url {
            self.ws_url = url;
        }
        if let Some(kp) = keypair {
            self.keypair_path = shellexpand(&kp);
        }
        if let Some(pda) = config_pda {
            self.config_pda = Some(pda);
        }
    }

    pub fn cluster_name(&self) -> &str {
        if self.rpc_url.contains("devnet") {
            "devnet"
        } else if self.rpc_url.contains("mainnet") {
            "mainnet"
        } else if self.rpc_url.contains("testnet") {
            "testnet"
        } else {
            "localnet"
        }
    }
}
