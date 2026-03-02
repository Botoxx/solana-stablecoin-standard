use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::{Result, TuiError};

/// What gets persisted to disk — only session state the user wants to remember.
/// Connection settings (rpc_url, ws_url, keypair_path) are NOT saved.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct SavedConfig {
    pub config_pda: Option<String>,
    pub mint: Option<String>,
}

/// Runtime config — connection settings resolved fresh each launch,
/// session state loaded from disk.
#[derive(Debug, Clone)]
pub struct TuiConfig {
    pub rpc_url: String,
    pub ws_url: String,
    pub keypair_path: String,
    pub config_pda: Option<String>,
    pub mint: Option<String>,
}

impl Default for TuiConfig {
    fn default() -> Self {
        let sol = SolanaCliConfig::load();
        Self {
            rpc_url: sol.rpc_url,
            ws_url: sol.ws_url,
            keypair_path: sol.keypair_path,
            config_pda: None,
            mint: None,
        }
    }
}

/// Reads defaults from `~/.config/solana/cli/config.yml` (same file `solana config get` uses).
/// Falls back to hardcoded devnet defaults if the file doesn't exist or can't be parsed.
struct SolanaCliConfig {
    rpc_url: String,
    ws_url: String,
    keypair_path: String,
}

impl SolanaCliConfig {
    fn load() -> Self {
        // Solana CLI always uses ~/.config/solana/cli/config.yml regardless of platform
        let path = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".config")
            .join("solana")
            .join("cli")
            .join("config.yml");

        let defaults = Self {
            rpc_url: "https://api.devnet.solana.com".into(),
            ws_url: "wss://api.devnet.solana.com".into(),
            keypair_path: shellexpand("~/.config/solana/id.json"),
        };

        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return defaults,
            Err(e) => {
                eprintln!(
                    "Warning: could not read Solana config {}: {e}. Using devnet defaults.",
                    path.display()
                );
                return defaults;
            }
        };

        let mut rpc_url = None;
        let mut ws_url = None;
        let mut keypair_path = None;

        for line in content.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("json_rpc_url:") {
                let v = val.trim().trim_matches('\'').trim_matches('"');
                if !v.is_empty() {
                    rpc_url = Some(v.to_string());
                }
            } else if let Some(val) = line.strip_prefix("websocket_url:") {
                let v = val.trim().trim_matches('\'').trim_matches('"');
                if !v.is_empty() {
                    ws_url = Some(v.to_string());
                }
            } else if let Some(val) = line.strip_prefix("keypair_path:") {
                let v = val.trim().trim_matches('\'').trim_matches('"');
                if !v.is_empty() {
                    keypair_path = Some(shellexpand(v));
                }
            }
        }

        // Derive WS URL from RPC URL if not set (same logic as Solana CLI)
        let rpc = rpc_url.unwrap_or(defaults.rpc_url);
        let ws = ws_url.unwrap_or_else(|| rpc_to_ws(&rpc));

        Self {
            rpc_url: rpc,
            ws_url: ws,
            keypair_path: keypair_path.unwrap_or(defaults.keypair_path),
        }
    }
}

/// Convert an RPC URL to a WebSocket URL (same as Solana CLI's computed default).
fn rpc_to_ws(rpc_url: &str) -> String {
    rpc_url
        .replace("https://", "wss://")
        .replace("http://", "ws://")
}

fn config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
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
    /// Load config: connection settings from Solana CLI (fresh every launch),
    /// session state (config_pda, mint) from saved file.
    pub fn load() -> Result<Self> {
        let mut cfg = Self::default();

        let path = config_path();
        if path.exists() {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| TuiError::Config(format!("read {}: {}", path.display(), e)))?;
            let saved: SavedConfig = toml::from_str(&content)
                .map_err(|e| TuiError::Config(format!("parse {}: {}", path.display(), e)))?;
            cfg.config_pda = saved.config_pda;
            cfg.mint = saved.mint;
        }

        Ok(cfg)
    }

    /// Save only session state — never persist connection settings.
    pub fn save(&self) -> Result<()> {
        let saved = SavedConfig {
            config_pda: self.config_pda.clone(),
            mint: self.mint.clone(),
        };

        let dir = config_dir();
        std::fs::create_dir_all(&dir)
            .map_err(|e| TuiError::Config(format!("mkdir {}: {}", dir.display(), e)))?;

        let content = toml::to_string_pretty(&saved)
            .map_err(|e| TuiError::Config(format!("serialize: {}", e)))?;

        let tmp = config_dir().join("config.toml.tmp");
        let path = config_path();
        // Remove stale tmp to avoid following symlinks (create_new fails on existing files)
        let _ = std::fs::remove_file(&tmp);
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true) // Fails if file exists (including symlinks) — prevents symlink attacks
            .open(&tmp)
            .and_then(|mut f| std::io::Write::write_all(&mut f, content.as_bytes()))
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
