use sss_tui::config::TuiConfig;

#[test]
fn test_config_default() {
    let cfg = TuiConfig::default();
    assert!(cfg.rpc_url.contains("devnet"));
    assert!(cfg.ws_url.contains("devnet"));
    assert!(cfg.config_pda.is_none());
    assert!(cfg.mint.is_none());
}

#[test]
fn test_config_serialize_roundtrip() {
    let cfg = TuiConfig {
        rpc_url: "https://api.devnet.solana.com".into(),
        ws_url: "wss://api.devnet.solana.com".into(),
        keypair_path: "/tmp/test-keypair.json".into(),
        config_pda: Some("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1".into()),
        mint: Some("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".into()),
    };

    let toml_str = toml::to_string_pretty(&cfg).expect("serialize");
    let parsed: TuiConfig = toml::from_str(&toml_str).expect("deserialize");

    assert_eq!(parsed.rpc_url, cfg.rpc_url);
    assert_eq!(parsed.ws_url, cfg.ws_url);
    assert_eq!(parsed.keypair_path, cfg.keypair_path);
    assert_eq!(parsed.config_pda, cfg.config_pda);
    assert_eq!(parsed.mint, cfg.mint);
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
    assert!(cfg.ws_url.contains("devnet")); // Unchanged
    assert!(cfg.keypair_path.contains("custom.json"));
    assert_eq!(cfg.config_pda, Some("ABC123".into()));
}

#[test]
fn test_cluster_name() {
    let mut cfg = TuiConfig::default();
    assert_eq!(cfg.cluster_name(), "devnet");

    cfg.rpc_url = "https://api.mainnet-beta.solana.com".into();
    assert_eq!(cfg.cluster_name(), "mainnet");

    cfg.rpc_url = "http://localhost:8899".into();
    assert_eq!(cfg.cluster_name(), "localnet");

    cfg.rpc_url = "https://api.testnet.solana.com".into();
    assert_eq!(cfg.cluster_name(), "testnet");
}

#[test]
fn test_config_file_roundtrip() {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("config.toml");

    let cfg = TuiConfig {
        rpc_url: "https://api.devnet.solana.com".into(),
        ws_url: "wss://api.devnet.solana.com".into(),
        keypair_path: "/tmp/test.json".into(),
        config_pda: Some("TestPDA".into()),
        mint: None,
    };

    let content = toml::to_string_pretty(&cfg).expect("serialize");
    std::fs::write(&path, &content).expect("write");

    let loaded: TuiConfig =
        toml::from_str(&std::fs::read_to_string(&path).expect("read")).expect("parse");

    assert_eq!(loaded.rpc_url, cfg.rpc_url);
    assert_eq!(loaded.config_pda, cfg.config_pda);
}
