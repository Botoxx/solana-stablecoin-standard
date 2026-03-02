use ratatui::backend::TestBackend;
use ratatui::Terminal;
use solana_sdk::pubkey::Pubkey;

use sss_tui::accounts::{BlacklistEntry, MinterConfig, RoleAssignment, StablecoinConfig};
use sss_tui::app::{App, ComplianceMode, InputMode, OpsTab, Screen};
use sss_tui::events::EventData;
use sss_tui::rpc::HolderInfo;

fn make_config(paused: bool, transfer_hook: bool) -> StablecoinConfig {
    StablecoinConfig {
        authority: Pubkey::new_from_array([1; 32]),
        pending_authority: None,
        mint: Pubkey::new_from_array([2; 32]),
        treasury: Pubkey::new_from_array([3; 32]),
        decimals: 6,
        paused,
        enable_permanent_delegate: true,
        enable_transfer_hook: transfer_hook,
        default_account_frozen: false,
        transfer_hook_program: None,
        total_minted: 1_000_000,
        total_burned: 100_000,
        bump: 255,
    }
}

fn make_event(name: &str) -> EventData {
    EventData {
        name: name.into(),
        authority: "test..auth".into(),
        timestamp: 1700000000,
        fields: vec![("amount".into(), "1000".into())],
        tx_sig: Some("abc123def456".into()),
    }
}

fn render_app(app: &App) {
    let backend = TestBackend::new(120, 30);
    let mut terminal = Terminal::new(backend).unwrap();
    terminal
        .draw(|f| {
            sss_tui::screens::render(f, app);
        })
        .unwrap();
}

fn render_app_to_string(app: &App) -> String {
    let backend = TestBackend::new(120, 30);
    let mut terminal = Terminal::new(backend).unwrap();
    terminal
        .draw(|f| {
            sss_tui::screens::render(f, app);
        })
        .unwrap();
    let buf = terminal.backend().buffer().clone();
    let mut output = String::new();
    for y in 0..buf.area.height {
        for x in 0..buf.area.width {
            output.push_str(buf.cell((x, y)).map(|c| c.symbol()).unwrap_or(" "));
        }
        output.push('\n');
    }
    output
}

// ---- Dashboard screen ----

#[test]
fn test_render_dashboard_no_config() {
    let app = App::new();
    render_app(&app); // should not panic
}

#[test]
fn test_render_dashboard_with_config() {
    let mut app = App::new();
    app.config = Some(make_config(false, true));
    app.token_name = Some("Test Stablecoin".into());
    app.token_symbol = Some("TSC".into());
    app.supply = Some(900_000);
    app.minters = vec![MinterConfig {
        config: Pubkey::new_from_array([1; 32]),
        minter: Pubkey::new_from_array([10; 32]),
        quota_total: 1_000_000,
        quota_remaining: 800_000,
        bump: 255,
    }];
    app.roles = vec![RoleAssignment {
        config: Pubkey::new_from_array([1; 32]),
        role_type: 0,
        address: Pubkey::new_from_array([10; 32]),
        assigned_by: Pubkey::new_from_array([1; 32]),
        assigned_at: 1700000000,
        bump: 255,
    }];
    app.events.push_back(make_event("Mint"));
    app.events.push_back(make_event("Burn"));

    render_app(&app);
}

#[test]
fn test_render_dashboard_paused() {
    let mut app = App::new();
    app.config = Some(make_config(true, false));
    render_app(&app);
}

// ---- Operations screen ----

#[test]
fn test_render_operations_mint() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    render_app(&app);
}

#[test]
fn test_render_operations_burn() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Burn;
    render_app(&app);
}

#[test]
fn test_render_operations_freeze() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Freeze;
    render_app(&app);
}

#[test]
fn test_render_operations_pause_active() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Pause;
    app.config = Some(make_config(false, false));
    render_app(&app);
}

#[test]
fn test_render_operations_pause_paused() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Pause;
    app.config = Some(make_config(true, false));
    render_app(&app);
}

// ---- Roles screen ----

#[test]
fn test_render_roles_empty() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    render_app(&app);
}

#[test]
fn test_render_roles_with_data() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles = vec![
        RoleAssignment {
            config: Pubkey::new_from_array([1; 32]),
            role_type: 0,
            address: Pubkey::new_from_array([10; 32]),
            assigned_by: Pubkey::new_from_array([1; 32]),
            assigned_at: 1700000000,
            bump: 255,
        },
        RoleAssignment {
            config: Pubkey::new_from_array([1; 32]),
            role_type: 2,
            address: Pubkey::new_from_array([11; 32]),
            assigned_by: Pubkey::new_from_array([1; 32]),
            assigned_at: 1700000001,
            bump: 254,
        },
    ];
    app.minters = vec![MinterConfig {
        config: Pubkey::new_from_array([1; 32]),
        minter: Pubkey::new_from_array([10; 32]),
        quota_total: 500_000,
        quota_remaining: 200_000,
        bump: 253,
    }];
    render_app(&app);
}

// ---- Compliance screen ----

#[test]
fn test_render_compliance_sss1() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.config = Some(make_config(false, false)); // SSS-1
    render_app(&app);
}

#[test]
fn test_render_compliance_sss2_empty() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.config = Some(make_config(false, true)); // SSS-2
    render_app(&app);
}

#[test]
fn test_render_compliance_sss2_with_blacklist() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.config = Some(make_config(false, true));
    app.blacklist = vec![
        BlacklistEntry {
            config: Pubkey::new_from_array([1; 32]),
            address: Pubkey::new_from_array([30; 32]),
            reason: "OFAC sanctioned".into(),
            blacklisted_at: 1700000000,
            blacklisted_by: Pubkey::new_from_array([1; 32]),
            active: true,
            bump: 255,
        },
        BlacklistEntry {
            config: Pubkey::new_from_array([1; 32]),
            address: Pubkey::new_from_array([31; 32]),
            reason: "Fraud".into(),
            blacklisted_at: 1700000001,
            blacklisted_by: Pubkey::new_from_array([1; 32]),
            active: false,
            bump: 254,
        },
    ];
    render_app(&app);
}

#[test]
fn test_render_compliance_no_config() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    // No config loaded = not SSS-2
    render_app(&app);
}

#[test]
fn test_render_compliance_seize_mode_shows_seize_title() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.config = Some(make_config(false, true)); // SSS-2
    app.compliance_mode = ComplianceMode::Seize;
    app.input_mode = InputMode::Editing;
    app.compliance_focus = 0;

    let output = render_app_to_string(&app);
    assert!(
        output.contains("Seize Tokens"),
        "Expected 'Seize Tokens' in output, got:\n{}",
        output
    );
    assert!(
        !output.contains("Add to Blacklist"),
        "Should NOT contain 'Add to Blacklist' in seize mode"
    );
}

#[test]
fn test_render_compliance_blacklist_mode_shows_blacklist_title() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.config = Some(make_config(false, true)); // SSS-2
    app.compliance_mode = ComplianceMode::Blacklist;
    app.input_mode = InputMode::Editing;
    app.compliance_focus = 0;

    let output = render_app_to_string(&app);
    assert!(
        output.contains("Add to Blacklist"),
        "Expected 'Add to Blacklist' in output, got:\n{}",
        output
    );
    assert!(
        !output.contains("Seize Tokens"),
        "Should NOT contain 'Seize Tokens' in blacklist mode"
    );
}

// ---- Events screen ----

#[test]
fn test_render_events_empty() {
    let mut app = App::new();
    app.screen = Screen::Events;
    render_app(&app);
}

#[test]
fn test_render_events_disconnected() {
    let mut app = App::new();
    app.screen = Screen::Events;
    app.ws_connected = false;
    render_app(&app);
}

#[test]
fn test_render_events_with_data() {
    let mut app = App::new();
    app.screen = Screen::Events;
    app.ws_connected = true;
    for name in ["Mint", "Burn", "Freeze", "Pause", "BlacklistAdd", "Seize"] {
        app.events.push_back(make_event(name));
    }
    render_app(&app);
}

#[test]
fn test_render_events_with_filter() {
    let mut app = App::new();
    app.screen = Screen::Events;
    app.events_filter = Some("Mint".into());
    app.events.push_back(make_event("Mint"));
    app.events.push_back(make_event("Burn"));
    render_app(&app);
}

// ---- Holders screen ----

#[test]
fn test_render_holders_empty() {
    let mut app = App::new();
    app.screen = Screen::Holders;
    render_app(&app);
}

#[test]
fn test_render_holders_with_data() {
    let mut app = App::new();
    app.screen = Screen::Holders;
    app.config = Some(make_config(false, false));
    app.supply = Some(3000);
    app.holders = vec![
        HolderInfo {
            owner: Pubkey::new_from_array([50; 32]),
            balance: 2000,
            frozen: false,
        },
        HolderInfo {
            owner: Pubkey::new_from_array([51; 32]),
            balance: 500,
            frozen: true,
        },
        HolderInfo {
            owner: Pubkey::new_from_array([52; 32]),
            balance: 500,
            frozen: false,
        },
    ];
    render_app(&app);
}

// ---- Overlay rendering ----

#[test]
fn test_render_with_toast() {
    let mut app = App::new();
    app.set_toast(sss_tui::app::Toast::success("Transaction confirmed"));
    render_app(&app);
}

#[test]
fn test_render_with_error_toast() {
    let mut app = App::new();
    app.set_toast(sss_tui::app::Toast::error("Unauthorized"));
    render_app(&app);
}

#[test]
fn test_render_with_help_overlay() {
    let mut app = App::new();
    app.show_help = true;
    render_app(&app);
}

#[test]
fn test_render_with_confirm_dialog() {
    let mut app = App::new();
    app.confirm = Some(sss_tui::app::ConfirmDialog {
        title: "Confirm Mint".into(),
        body: "Mint 1000 tokens to wallet".into(),
        on_confirm: sss_tui::app::ConfirmAction::Mint {
            recipient: "test".into(),
            amount: 1000,
        },
        selected: true,
    });
    render_app(&app);
}

// ---- Small terminal ----

#[test]
fn test_render_small_terminal() {
    let mut app = App::new();
    app.config = Some(make_config(false, true));
    app.minters = vec![MinterConfig {
        config: Pubkey::new_from_array([1; 32]),
        minter: Pubkey::new_from_array([10; 32]),
        quota_total: 500_000,
        quota_remaining: 200_000,
        bump: 253,
    }];

    // Test with minimum-ish terminal size
    let backend = TestBackend::new(80, 24);
    let mut terminal = Terminal::new(backend).unwrap();
    terminal
        .draw(|f| sss_tui::screens::render(f, &app))
        .unwrap();
}
