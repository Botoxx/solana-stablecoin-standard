use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyEventState, KeyModifiers};
use solana_sdk::pubkey::Pubkey;
use tokio::sync::mpsc;

use sss_tui::accounts::{BlacklistEntry, MinterConfig, RoleAssignment, StablecoinConfig};
use sss_tui::app::{App, ConfirmAction, InputMode, OpsTab, RolesTab, Screen};
use sss_tui::config::TuiConfig;
use sss_tui::event::AppEvent;
use sss_tui::rpc::{HolderInfo, SolanaRpc};
use sss_tui::widgets::input_field;

fn key(code: KeyCode) -> KeyEvent {
    KeyEvent {
        code,
        modifiers: KeyModifiers::NONE,
        kind: KeyEventKind::Press,
        state: KeyEventState::NONE,
    }
}

fn shift_key(code: KeyCode) -> KeyEvent {
    KeyEvent {
        code,
        modifiers: KeyModifiers::SHIFT,
        kind: KeyEventKind::Press,
        state: KeyEventState::NONE,
    }
}

fn send_key(app: &mut App, code: KeyCode) {
    let rpc = SolanaRpc::new("http://localhost:8899");
    let keypair = solana_sdk::signer::keypair::Keypair::new();
    let (tx, _rx) = mpsc::unbounded_channel::<AppEvent>();
    let mut cfg = TuiConfig::default();
    sss_tui::screens::handle_input(app, key(code), &rpc, &keypair, &tx, &mut cfg, None);
}

fn send_key_event(app: &mut App, evt: KeyEvent) {
    let rpc = SolanaRpc::new("http://localhost:8899");
    let keypair = solana_sdk::signer::keypair::Keypair::new();
    let (tx, _rx) = mpsc::unbounded_channel::<AppEvent>();
    let mut cfg = TuiConfig::default();
    sss_tui::screens::handle_input(app, evt, &rpc, &keypair, &tx, &mut cfg, None);
}

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

// ---- Operations screen tests ----

#[test]
fn test_ops_tab_cycling() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    assert_eq!(app.ops_tab, OpsTab::Mint);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_tab, OpsTab::Burn);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_tab, OpsTab::Freeze);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_tab, OpsTab::Thaw);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_tab, OpsTab::Pause);

    // Wraps around
    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_tab, OpsTab::Mint);
}

#[test]
fn test_ops_enter_edit_mode() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    assert_eq!(app.input_mode, InputMode::Normal);

    send_key(&mut app, KeyCode::Char('e'));
    assert_eq!(app.input_mode, InputMode::Editing);
}

#[test]
fn test_ops_i_enters_edit_mode() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Freeze;

    send_key(&mut app, KeyCode::Char('i'));
    assert_eq!(app.input_mode, InputMode::Editing);
}

#[test]
fn test_ops_pause_no_edit_mode() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Pause;

    send_key(&mut app, KeyCode::Char('e'));
    assert_eq!(app.input_mode, InputMode::Normal); // pause has no edit mode
}

#[test]
fn test_ops_submit_mint_empty_fields_error() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    app.input_mode = InputMode::Editing;

    // Submit with empty fields
    send_key(&mut app, KeyCode::Enter);
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
    assert!(app.confirm.is_none()); // no confirm dialog
}

#[test]
fn test_ops_submit_mint_valid_creates_confirm() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    app.input_mode = InputMode::Editing;
    app.ops_fields[0] = Pubkey::new_from_array([5; 32]).to_string();
    app.ops_fields[1] = "1000".into();

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    let dialog = app.confirm.as_ref().unwrap();
    assert_eq!(dialog.title, "Confirm Mint");
    match &dialog.on_confirm {
        ConfirmAction::Mint { amount, .. } => assert_eq!(*amount, 1000),
        _ => panic!("Expected Mint action"),
    }
    assert_eq!(app.input_mode, InputMode::Normal);
}

#[test]
fn test_ops_submit_mint_invalid_amount_error() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    app.input_mode = InputMode::Editing;
    app.ops_fields[0] = Pubkey::new_from_array([5; 32]).to_string();
    app.ops_fields[1] = "0".into(); // zero is invalid

    send_key(&mut app, KeyCode::Enter);
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
    assert!(app.confirm.is_none());
}

#[test]
fn test_ops_submit_burn_empty_source_is_none() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Burn;
    app.input_mode = InputMode::Editing;
    app.ops_fields[0] = String::new(); // empty source = self
    app.ops_fields[1] = "500".into();

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::Burn { source, amount } => {
            assert!(source.is_none());
            assert_eq!(*amount, 500);
        }
        _ => panic!("Expected Burn action"),
    }
}

#[test]
fn test_ops_submit_freeze_creates_confirm() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Freeze;
    app.input_mode = InputMode::Editing;
    app.ops_fields[0] = Pubkey::new_from_array([7; 32]).to_string();

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    assert_eq!(app.confirm.as_ref().unwrap().title, "Confirm Freeze");
}

#[test]
fn test_ops_submit_freeze_empty_wallet_error() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Freeze;
    app.input_mode = InputMode::Editing;
    // empty wallet

    send_key(&mut app, KeyCode::Enter);
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
}

#[test]
fn test_ops_submit_pause_toggle() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Pause;
    app.config = Some(make_config(false, false));

    // Normal mode Enter triggers pause
    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::Pause => {}
        _ => panic!("Expected Pause action"),
    }

    // Reset and test unpause
    app.confirm = None;
    app.config = Some(make_config(true, false));
    send_key(&mut app, KeyCode::Enter);
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::Unpause => {}
        _ => panic!("Expected Unpause action"),
    }
}

#[test]
fn test_ops_tab_field_cycling_in_edit() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    app.input_mode = InputMode::Editing;
    assert_eq!(app.ops_focus, 0);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_focus, 1);

    // Wraps back
    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.ops_focus, 0);
}

#[test]
fn test_ops_shift_tab_reverse_cycling() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    app.input_mode = InputMode::Editing;
    assert_eq!(app.ops_focus, 0);

    // Shift+Tab from 0 wraps to max (1 for mint)
    send_key_event(&mut app, shift_key(KeyCode::Tab));
    assert_eq!(app.ops_focus, 1);

    send_key_event(&mut app, shift_key(KeyCode::Tab));
    assert_eq!(app.ops_focus, 0);
}

#[test]
fn test_ops_char_input_in_edit_mode() {
    let mut app = App::new();
    app.screen = Screen::Operations;
    app.ops_tab = OpsTab::Mint;
    app.input_mode = InputMode::Editing;
    app.ops_focus = 0;

    send_key(&mut app, KeyCode::Char('A'));
    assert_eq!(app.ops_fields[0], "A");

    send_key(&mut app, KeyCode::Char('B'));
    assert_eq!(app.ops_fields[0], "AB");

    send_key(&mut app, KeyCode::Backspace);
    assert_eq!(app.ops_fields[0], "A");
}

// ---- Roles screen tests ----

#[test]
fn test_roles_tab_toggles_panels() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    assert_eq!(app.roles_tab, RolesTab::Roles);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.roles_tab, RolesTab::Minters);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.roles_tab, RolesTab::Roles);
}

#[test]
fn test_roles_jk_navigation() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Roles;
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
            role_type: 1,
            address: Pubkey::new_from_array([11; 32]),
            assigned_by: Pubkey::new_from_array([1; 32]),
            assigned_at: 1700000001,
            bump: 254,
        },
    ];
    assert_eq!(app.roles_selected, 0);

    send_key(&mut app, KeyCode::Char('j'));
    assert_eq!(app.roles_selected, 1);

    // Can't go past end
    send_key(&mut app, KeyCode::Char('j'));
    assert_eq!(app.roles_selected, 1);

    send_key(&mut app, KeyCode::Char('k'));
    assert_eq!(app.roles_selected, 0);

    // Can't go below 0
    send_key(&mut app, KeyCode::Char('k'));
    assert_eq!(app.roles_selected, 0);
}

#[test]
fn test_roles_a_enters_edit() {
    let mut app = App::new();
    app.screen = Screen::Roles;

    send_key(&mut app, KeyCode::Char('a'));
    assert_eq!(app.input_mode, InputMode::Editing);
    assert_eq!(app.roles_fields.len(), 3);
    assert_eq!(app.roles_focus, 0);
}

#[test]
fn test_roles_d_revokes_selected() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Roles;
    let addr = Pubkey::new_from_array([10; 32]);
    app.roles = vec![RoleAssignment {
        config: Pubkey::new_from_array([1; 32]),
        role_type: 2, // Pauser
        address: addr,
        assigned_by: Pubkey::new_from_array([1; 32]),
        assigned_at: 1700000000,
        bump: 255,
    }];
    app.roles_selected = 0;

    send_key(&mut app, KeyCode::Char('d'));
    assert!(app.confirm.is_some());
    let dialog = app.confirm.as_ref().unwrap();
    assert_eq!(dialog.title, "Revoke Role");
    match &dialog.on_confirm {
        ConfirmAction::RevokeRole {
            address,
            role_type,
        } => {
            assert_eq!(*address, addr.to_string());
            assert_eq!(*role_type, 2);
        }
        _ => panic!("Expected RevokeRole"),
    }
}

#[test]
fn test_roles_submit_assign() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Roles;
    app.input_mode = InputMode::Editing;
    app.roles_fields = vec![
        Pubkey::new_from_array([20; 32]).to_string(),
        "minter".into(),
        String::new(),
    ];

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::AssignRole { role_type, .. } => assert_eq!(*role_type, 0),
        _ => panic!("Expected AssignRole"),
    }
}

#[test]
fn test_roles_submit_assign_invalid_role_error() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Roles;
    app.input_mode = InputMode::Editing;
    app.roles_fields = vec![
        Pubkey::new_from_array([20; 32]).to_string(),
        "invalid".into(),
        String::new(),
    ];

    send_key(&mut app, KeyCode::Enter);
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
    assert!(app.confirm.is_none());
}

#[test]
fn test_roles_submit_add_minter() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Minters;
    app.input_mode = InputMode::Editing;
    app.roles_fields = vec![
        Pubkey::new_from_array([20; 32]).to_string(),
        String::new(),
        "50000".into(),
    ];

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::AddMinter { quota, .. } => assert_eq!(*quota, 50000),
        _ => panic!("Expected AddMinter"),
    }
}

// ---- Compliance screen tests ----

#[test]
fn test_compliance_jk_navigation() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.blacklist = vec![
        BlacklistEntry {
            config: Pubkey::new_from_array([1; 32]),
            address: Pubkey::new_from_array([30; 32]),
            reason: "OFAC".into(),
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
            active: true,
            bump: 254,
        },
    ];

    send_key(&mut app, KeyCode::Char('j'));
    assert_eq!(app.compliance_selected, 1);

    send_key(&mut app, KeyCode::Char('k'));
    assert_eq!(app.compliance_selected, 0);
}

#[test]
fn test_compliance_a_enters_blacklist_edit() {
    let mut app = App::new();
    app.screen = Screen::Compliance;

    send_key(&mut app, KeyCode::Char('a'));
    assert_eq!(app.input_mode, InputMode::Editing);
    assert_eq!(app.compliance_fields.len(), 3);
}

#[test]
fn test_compliance_s_enters_seize_edit() {
    let mut app = App::new();
    app.screen = Screen::Compliance;

    send_key(&mut app, KeyCode::Char('s'));
    assert_eq!(app.input_mode, InputMode::Editing);
}

#[test]
fn test_compliance_submit_seize() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.input_mode = InputMode::Editing;
    app.compliance_fields = vec![
        Pubkey::new_from_array([40; 32]).to_string(),
        String::new(),
        "10000".into(),
    ];

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::Seize { amount, .. } => assert_eq!(*amount, 10000),
        _ => panic!("Expected Seize"),
    }
}

#[test]
fn test_compliance_submit_blacklist_add() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.input_mode = InputMode::Editing;
    app.compliance_fields = vec![
        Pubkey::new_from_array([40; 32]).to_string(),
        "OFAC sanctions".into(),
        String::new(), // no amount = blacklist add
    ];

    send_key(&mut app, KeyCode::Enter);
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::AddBlacklist { reason, .. } => assert_eq!(reason, "OFAC sanctions"),
        _ => panic!("Expected AddBlacklist"),
    }
}

#[test]
fn test_compliance_submit_blacklist_no_reason_error() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.input_mode = InputMode::Editing;
    app.compliance_fields = vec![
        Pubkey::new_from_array([40; 32]).to_string(),
        String::new(), // no reason
        String::new(), // no amount
    ];

    send_key(&mut app, KeyCode::Enter);
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
    assert!(app.confirm.is_none());
}

#[test]
fn test_compliance_d_remove_active_blacklist() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.blacklist = vec![BlacklistEntry {
        config: Pubkey::new_from_array([1; 32]),
        address: Pubkey::new_from_array([30; 32]),
        reason: "OFAC".into(),
        blacklisted_at: 1700000000,
        blacklisted_by: Pubkey::new_from_array([1; 32]),
        active: true,
        bump: 255,
    }];
    app.compliance_selected = 0;

    send_key(&mut app, KeyCode::Char('d'));
    assert!(app.confirm.is_some());
    match &app.confirm.as_ref().unwrap().on_confirm {
        ConfirmAction::RemoveBlacklist { .. } => {}
        _ => panic!("Expected RemoveBlacklist"),
    }
}

#[test]
fn test_compliance_d_inactive_shows_toast() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.blacklist = vec![BlacklistEntry {
        config: Pubkey::new_from_array([1; 32]),
        address: Pubkey::new_from_array([30; 32]),
        reason: "OFAC".into(),
        blacklisted_at: 1700000000,
        blacklisted_by: Pubkey::new_from_array([1; 32]),
        active: false,
        bump: 255,
    }];
    app.compliance_selected = 0;

    send_key(&mut app, KeyCode::Char('d'));
    assert!(app.confirm.is_none()); // no confirm for inactive
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
}

#[test]
fn test_compliance_d_empty_shows_toast() {
    let mut app = App::new();
    app.screen = Screen::Compliance;
    // empty blacklist

    send_key(&mut app, KeyCode::Char('d'));
    assert!(app.confirm.is_none());
    assert!(app.toast.is_some());
    assert!(app.toast.as_ref().unwrap().is_error);
}

#[test]
fn test_roles_d_removes_minter() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Minters;
    let addr = Pubkey::new_from_array([40; 32]);
    app.minters = vec![MinterConfig {
        config: Pubkey::new_from_array([1; 32]),
        minter: addr,
        quota_total: 1000,
        quota_remaining: 500,
        bump: 255,
    }];
    app.roles_selected = 0;

    send_key(&mut app, KeyCode::Char('d'));
    assert!(app.confirm.is_some());
    let dialog = app.confirm.as_ref().unwrap();
    assert_eq!(dialog.title, "Remove Minter");
    match &dialog.on_confirm {
        ConfirmAction::RemoveMinter { address } => {
            assert_eq!(*address, addr.to_string());
        }
        _ => panic!("Expected RemoveMinter"),
    }
}

// ---- Events screen tests ----

#[test]
fn test_events_jk_scroll() {
    let mut app = App::new();
    app.screen = Screen::Events;

    send_key(&mut app, KeyCode::Char('j'));
    assert!(!app.events_auto_scroll);
    assert_eq!(app.events_scroll, 1);

    send_key(&mut app, KeyCode::Char('k'));
    assert_eq!(app.events_scroll, 0);

    // Can't go below 0
    send_key(&mut app, KeyCode::Char('k'));
    assert_eq!(app.events_scroll, 0);
}

#[test]
fn test_events_g_jump_top() {
    let mut app = App::new();
    app.screen = Screen::Events;
    app.events_scroll = 50;
    app.events_auto_scroll = false;

    send_key(&mut app, KeyCode::Char('g'));
    assert_eq!(app.events_scroll, 0);
    assert!(!app.events_auto_scroll);
}

#[test]
fn test_events_big_g_auto_scroll() {
    let mut app = App::new();
    app.screen = Screen::Events;
    app.events_auto_scroll = false;

    send_key_event(&mut app, shift_key(KeyCode::Char('G')));
    assert!(app.events_auto_scroll);
}

#[test]
fn test_events_f_filter_toggle() {
    let mut app = App::new();
    app.screen = Screen::Events;
    assert!(app.events_filter.is_none());

    send_key(&mut app, KeyCode::Char('f'));
    assert_eq!(app.events_filter.as_deref(), Some("Mint"));

    send_key(&mut app, KeyCode::Char('f'));
    assert!(app.events_filter.is_none());
}

// ---- Holders screen tests ----

#[test]
fn test_holders_jk_navigation() {
    let mut app = App::new();
    app.screen = Screen::Holders;
    app.holders = vec![
        HolderInfo {
            owner: Pubkey::new_from_array([50; 32]),
            balance: 1000,
            frozen: false,
        },
        HolderInfo {
            owner: Pubkey::new_from_array([51; 32]),
            balance: 2000,
            frozen: true,
        },
    ];

    send_key(&mut app, KeyCode::Char('j'));
    assert_eq!(app.holders_selected, 1);

    send_key(&mut app, KeyCode::Char('j'));
    assert_eq!(app.holders_selected, 1); // clamped

    send_key(&mut app, KeyCode::Char('k'));
    assert_eq!(app.holders_selected, 0);
}

#[test]
fn test_holders_empty_jk_no_panic() {
    let mut app = App::new();
    app.screen = Screen::Holders;
    // empty holders
    send_key(&mut app, KeyCode::Char('j'));
    assert_eq!(app.holders_selected, 0);
}

// ---- Input field validation tests ----

#[test]
fn test_input_field_handle_key_char() {
    let mut value = String::new();
    input_field::handle_key(&mut value, KeyCode::Char('A'));
    assert_eq!(value, "A");
    input_field::handle_key(&mut value, KeyCode::Char('b'));
    assert_eq!(value, "Ab");
}

#[test]
fn test_input_field_handle_key_backspace() {
    let mut value = "hello".to_string();
    input_field::handle_key(&mut value, KeyCode::Backspace);
    assert_eq!(value, "hell");
    input_field::handle_key(&mut value, KeyCode::Backspace);
    assert_eq!(value, "hel");
}

#[test]
fn test_input_field_backspace_empty() {
    let mut value = String::new();
    input_field::handle_key(&mut value, KeyCode::Backspace);
    assert!(value.is_empty()); // no panic
}

#[test]
fn test_is_valid_pubkey() {
    assert!(input_field::is_valid_pubkey("")); // empty allowed
    assert!(input_field::is_valid_pubkey(
        &Pubkey::new_from_array([1; 32]).to_string()
    ));
    assert!(input_field::is_valid_pubkey("11111111111111111111111111111111")); // system program
    assert!(!input_field::is_valid_pubkey("not_a_pubkey"));
    assert!(!input_field::is_valid_pubkey("short"));
}

#[test]
fn test_is_valid_amount() {
    assert!(input_field::is_valid_amount("")); // empty allowed
    assert!(input_field::is_valid_amount("1"));
    assert!(input_field::is_valid_amount("1000000"));
    assert!(!input_field::is_valid_amount("0")); // zero not valid
    assert!(!input_field::is_valid_amount("-1"));
    assert!(!input_field::is_valid_amount("abc"));
    assert!(!input_field::is_valid_amount("1.5")); // no decimals
}

// ---- Compliance tab cycling in edit mode ----

#[test]
fn test_compliance_tab_cycles_fields_in_edit() {
    use sss_tui::app::ComplianceMode;

    // Blacklist mode: 0 (address) ↔ 1 (reason)
    let mut app = App::new();
    app.screen = Screen::Compliance;
    app.input_mode = InputMode::Editing;
    app.compliance_mode = ComplianceMode::Blacklist;
    app.compliance_focus = 0;

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.compliance_focus, 1);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.compliance_focus, 0); // wraps

    // Seize mode: 0 (address) ↔ 2 (amount)
    app.compliance_mode = ComplianceMode::Seize;
    app.compliance_focus = 0;

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.compliance_focus, 2);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.compliance_focus, 0); // wraps
}

// ---- Roles edit field cycling ----

#[test]
fn test_roles_tab_cycles_fields_in_edit() {
    let mut app = App::new();
    app.screen = Screen::Roles;
    app.roles_tab = RolesTab::Roles;
    app.input_mode = InputMode::Editing;
    app.roles_focus = 0;

    // Roles tab has max=1 (address + role_type)
    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.roles_focus, 1);

    send_key(&mut app, KeyCode::Tab);
    assert_eq!(app.roles_focus, 0); // wraps
}
