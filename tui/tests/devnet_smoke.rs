//! End-to-end smoke test against devnet.
//! Fetches real data from the config PDA and renders all 6 screens.
//!
//! Run with: cargo test --test devnet_smoke -- --ignored --nocapture

use ratatui::backend::TestBackend;
use ratatui::Terminal;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use sss_tui::app::{App, OpsTab, Screen};
use sss_tui::rpc::SolanaRpc;

const CONFIG_PDA: &str = "HvFSuE1Uc7PXxRqeFX2y55eMgmMBCDmskpmrWomuV93i";
const RPC_URL: &str = "https://api.devnet.solana.com";

async fn fetch_and_populate() -> App {
    let rpc = SolanaRpc::new(RPC_URL);
    let config_pda = Pubkey::from_str(CONFIG_PDA).unwrap();

    let data = sss_tui::rpc::fetch_all_data(&rpc, &config_pda).await;

    let mut app = App::new();
    app.config = data.config;
    app.token_name = data.token_name;
    app.token_symbol = data.token_symbol;
    app.minters = data.minters;
    app.roles = data.roles;
    app.blacklist = data.blacklist;
    app.holders = data.holders;
    app.supply = data.supply;
    app.last_refresh = Some(std::time::Instant::now());
    app
}

fn render_and_capture(app: &App) -> String {
    let backend = TestBackend::new(120, 40);
    let mut terminal = Terminal::new(backend).unwrap();
    terminal
        .draw(|f| sss_tui::screens::render(f, app))
        .unwrap();

    // Extract text from buffer
    let buf = terminal.backend().buffer();
    let mut output = String::new();
    for y in 0..buf.area.height {
        for x in 0..buf.area.width {
            let cell = &buf[(x, y)];
            output.push_str(cell.symbol());
        }
        output.push('\n');
    }
    output
}

#[tokio::test]
#[ignore] // requires network — run with: cargo test --test devnet_smoke -- --ignored --nocapture
async fn test_devnet_dashboard() {
    let app = fetch_and_populate().await;

    assert!(app.config.is_some(), "Config PDA should be fetchable from devnet");
    let config = app.config.as_ref().unwrap();

    println!("=== Config loaded ===");
    println!("  Authority: {}", config.authority);
    println!("  Mint:      {}", config.mint);
    println!("  Treasury:  {}", config.treasury);
    println!("  Decimals:  {}", config.decimals);
    println!("  Paused:    {}", config.paused);
    println!("  SSS-2:     {}", config.enable_transfer_hook);
    println!("  Supply:    {:?}", app.supply);
    println!("  Name:      {:?}", app.token_name);
    println!("  Symbol:    {:?}", app.token_symbol);
    println!("  Minters:   {}", app.minters.len());
    println!("  Roles:     {}", app.roles.len());
    println!("  Blacklist: {}", app.blacklist.len());
    println!("  Holders:   {}", app.holders.len());

    // Verify data integrity
    assert_eq!(config.decimals, 6, "Expected 6 decimals");
    assert!(app.token_name.is_some(), "Token name should be fetchable");
    assert!(app.token_symbol.is_some(), "Token symbol should be fetchable");
}

#[tokio::test]
#[ignore]
async fn test_devnet_render_all_screens() {
    let mut app = fetch_and_populate().await;
    assert!(app.config.is_some(), "Need devnet data");

    let screens = [
        (Screen::Dashboard, "Dashboard"),
        (Screen::Operations, "Operations"),
        (Screen::Roles, "Roles"),
        (Screen::Compliance, "Compliance"),
        (Screen::Events, "Events"),
        (Screen::Holders, "Holders"),
    ];

    for (screen, name) in screens {
        app.screen = screen;
        if screen == Screen::Operations {
            app.ops_tab = OpsTab::Mint;
        }
        let output = render_and_capture(&app);

        println!("\n=== {} Screen ===", name);
        // Print first 15 lines for visual inspection
        for line in output.lines().take(15) {
            println!("{}", line);
        }

        // Basic smoke: not empty, contains the screen name or relevant content
        assert!(
            !output.trim().is_empty(),
            "{name} screen rendered empty"
        );
    }
}

#[tokio::test]
#[ignore]
async fn test_devnet_dashboard_contains_real_data() {
    let mut app = fetch_and_populate().await;
    assert!(app.config.is_some());

    app.screen = Screen::Dashboard;
    let output = render_and_capture(&app);

    // Check that real token data appears in the rendered output
    let token_name = app.token_name.as_deref().unwrap_or("???");
    let token_symbol = app.token_symbol.as_deref().unwrap_or("???");

    println!("Looking for '{}' and '{}' in dashboard output", token_name, token_symbol);
    println!("{}", output);

    assert!(
        output.contains(token_name) || output.contains(token_symbol),
        "Dashboard should contain token name or symbol"
    );
    assert!(
        output.contains("Supply") || output.contains("Minted"),
        "Dashboard should show supply section"
    );
    assert!(
        output.contains("Status"),
        "Dashboard should show status section"
    );
}

#[tokio::test]
#[ignore]
async fn test_devnet_holders_populated() {
    let app = fetch_and_populate().await;
    println!("Holders found: {}", app.holders.len());
    for h in &app.holders {
        println!("  {} — balance: {}, frozen: {}", h.owner, h.balance, h.frozen);
    }
    // At least the treasury or some test account should hold tokens
    // (may be 0 if all burned — don't hard-assert)
}

#[tokio::test]
#[ignore]
async fn test_devnet_compliance_screen_sss2() {
    let mut app = fetch_and_populate().await;
    assert!(app.config.is_some());

    app.screen = Screen::Compliance;
    let output = render_and_capture(&app);
    println!("{}", output);

    if app.is_sss2() {
        assert!(
            output.contains("Blacklist") || output.contains("Seize"),
            "SSS-2 compliance should show blacklist/seize"
        );
    } else {
        assert!(
            output.contains("not enabled") || output.contains("SSS-1"),
            "SSS-1 should show compliance not enabled"
        );
    }
}
