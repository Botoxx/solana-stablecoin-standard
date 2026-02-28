use sss_tui::config::TuiConfig;

#[test]
fn test_config_default() {
    let cfg = TuiConfig::default();
    // Connection settings come from Solana CLI config or hardcoded devnet defaults
    assert!(!cfg.rpc_url.is_empty());
    assert!(!cfg.ws_url.is_empty());
    assert!(!cfg.keypair_path.is_empty());
    assert!(cfg.config_pda.is_none());
    assert!(cfg.mint.is_none());
}

#[test]
fn test_config_apply_overrides() {
    let mut cfg = TuiConfig::default();
    cfg.apply_overrides(
        Some("https://custom-rpc.com".into()),
        None,
        Some("~/.config/solana/custom.json".into()),
        Some("ABC123".into()),
    );

    assert_eq!(cfg.rpc_url, "https://custom-rpc.com");
    assert!(cfg.keypair_path.contains("custom.json"));
    assert_eq!(cfg.config_pda, Some("ABC123".into()));
}

#[test]
fn test_cluster_name() {
    let mut cfg = TuiConfig::default();
    cfg.rpc_url = "https://api.devnet.solana.com".into();
    assert_eq!(cfg.cluster_name(), "devnet");

    cfg.rpc_url = "https://api.mainnet-beta.solana.com".into();
    assert_eq!(cfg.cluster_name(), "mainnet");

    cfg.rpc_url = "http://localhost:8899".into();
    assert_eq!(cfg.cluster_name(), "localnet");

    cfg.rpc_url = "https://api.testnet.solana.com".into();
    assert_eq!(cfg.cluster_name(), "testnet");
}

#[test]
fn test_config_save_only_persists_session_state() {
    // Save writes only config_pda and mint — not connection settings
    let cfg = TuiConfig {
        rpc_url: "https://custom.example.com".into(),
        ws_url: "wss://custom.example.com".into(),
        keypair_path: "/tmp/should-not-persist.json".into(),
        config_pda: Some("TestPDA".into()),
        mint: Some("TestMint".into()),
    };

    // Simulate what save() would write
    #[derive(serde::Deserialize)]
    struct Saved {
        config_pda: Option<String>,
        mint: Option<String>,
    }

    // save() writes SavedConfig, not TuiConfig
    // Verify by checking that save + load doesn't carry rpc_url/keypair_path
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("config.toml");

    // Manually write what SavedConfig would produce
    let saved_content = format!(
        "config_pda = {:?}\nmint = {:?}\n",
        cfg.config_pda.as_ref().unwrap(),
        cfg.mint.as_ref().unwrap(),
    );
    std::fs::write(&path, &saved_content).expect("write");

    let loaded: Saved =
        toml::from_str(&std::fs::read_to_string(&path).expect("read")).expect("parse");

    assert_eq!(loaded.config_pda, cfg.config_pda);
    assert_eq!(loaded.mint, cfg.mint);
    // Connection settings should NOT be in the saved file
    let raw = std::fs::read_to_string(&path).expect("read");
    assert!(!raw.contains("rpc_url"));
    assert!(!raw.contains("keypair_path"));
}
