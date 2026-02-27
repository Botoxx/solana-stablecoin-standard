use sss_tui::app::{App, InputMode, OpsTab, Screen, Toast};
use sss_tui::accounts::StablecoinConfig;
use sss_tui::events::EventData;
use sss_tui::theme;
use solana_sdk::pubkey::Pubkey;

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
        authority: "test".into(),
        timestamp: 1700000000,
        fields: vec![],
        tx_sig: None,
    }
}

#[test]
fn test_app_new_defaults() {
    let app = App::new();
    assert!(app.running);
    assert_eq!(app.screen, Screen::Dashboard);
    assert_eq!(app.input_mode, InputMode::Normal);
    assert!(app.config.is_none());
    assert!(app.token_name.is_none());
    assert!(app.minters.is_empty());
    assert!(app.roles.is_empty());
    assert!(app.blacklist.is_empty());
    assert!(app.holders.is_empty());
    assert!(app.supply.is_none());
    assert!(app.events.is_empty());
    assert!(app.toast.is_none());
    assert!(app.confirm.is_none());
    assert!(!app.show_help);
    assert_eq!(app.ops_tab, OpsTab::Mint);
    assert_eq!(app.ops_fields.len(), 2);
    assert_eq!(app.ops_focus, 0);
    assert!(!app.tx_pending);
    assert!(!app.ws_connected);
    assert!(app.events_auto_scroll);
}

#[test]
fn test_push_event_adds_to_queue() {
    let mut app = App::new();
    app.push_event(make_event("Mint"));
    assert_eq!(app.events.len(), 1);
    assert_eq!(app.events[0].name, "Mint");
}

#[test]
fn test_push_event_overflow_caps_at_500() {
    let mut app = App::new();
    for i in 0..510 {
        app.push_event(make_event(&format!("Event{i}")));
    }
    assert_eq!(app.events.len(), 500);
    // First 10 should have been evicted
    assert_eq!(app.events[0].name, "Event10");
    assert_eq!(app.events[499].name, "Event509");
}

#[test]
fn test_push_event_auto_scroll_tracks_latest() {
    let mut app = App::new();
    assert!(app.events_auto_scroll);
    app.push_event(make_event("A"));
    assert_eq!(app.events_scroll, 0);
    app.push_event(make_event("B"));
    assert_eq!(app.events_scroll, 1);
    app.push_event(make_event("C"));
    assert_eq!(app.events_scroll, 2);
}

#[test]
fn test_push_event_no_auto_scroll_stays_put() {
    let mut app = App::new();
    app.events_auto_scroll = false;
    app.push_event(make_event("A"));
    assert_eq!(app.events_scroll, 0);
    app.push_event(make_event("B"));
    assert_eq!(app.events_scroll, 0); // didn't move
}

#[test]
fn test_toast_success() {
    let t = Toast::success("done");
    assert_eq!(t.message, "done");
    assert!(!t.is_error);
    assert!(!t.is_expired());
}

#[test]
fn test_toast_error() {
    let t = Toast::error("fail");
    assert_eq!(t.message, "fail");
    assert!(t.is_error);
}

#[test]
fn test_clear_expired_toast_fresh_stays() {
    let mut app = App::new();
    app.set_toast(Toast::success("fresh"));
    app.clear_expired_toast();
    assert!(app.toast.is_some());
}

#[test]
fn test_is_sss2_true_when_transfer_hook() {
    let mut app = App::new();
    app.config = Some(make_config(false, true));
    assert!(app.is_sss2());
}

#[test]
fn test_is_sss2_false_when_no_hook() {
    let mut app = App::new();
    app.config = Some(make_config(false, false));
    assert!(!app.is_sss2());
}

#[test]
fn test_is_sss2_false_when_no_config() {
    let app = App::new();
    assert!(!app.is_sss2());
}

#[test]
fn test_is_paused() {
    let mut app = App::new();
    assert!(!app.is_paused());
    app.config = Some(make_config(true, false));
    assert!(app.is_paused());
    app.config = Some(make_config(false, false));
    assert!(!app.is_paused());
}

#[test]
fn test_reset_ops_fields() {
    let mut app = App::new();
    app.ops_fields[0] = "some_value".into();
    app.ops_focus = 1;
    app.reset_ops_fields();
    assert_eq!(app.ops_fields.len(), 2);
    assert!(app.ops_fields[0].is_empty());
    assert!(app.ops_fields[1].is_empty());
    assert_eq!(app.ops_focus, 0);
}

// Theme helper tests

#[test]
fn test_truncate_pubkey_long() {
    let pk = "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1";
    let result = theme::truncate_pubkey(pk, 4);
    assert_eq!(result, "Fjv9..14n1");
}

#[test]
fn test_truncate_pubkey_short() {
    let pk = "short";
    let result = theme::truncate_pubkey(pk, 4);
    assert_eq!(result, "short"); // too short to truncate
}

#[test]
fn test_format_amount_with_decimals() {
    assert_eq!(theme::format_amount(1_000_000, 6), "1.000000");
    assert_eq!(theme::format_amount(1_500_000, 6), "1.500000");
    assert_eq!(theme::format_amount(500, 6), "0.000500");
    assert_eq!(theme::format_amount(0, 6), "0.000000");
}

#[test]
fn test_format_amount_zero_decimals() {
    assert_eq!(theme::format_amount(42, 0), "42");
    assert_eq!(theme::format_amount(0, 0), "0");
}

#[test]
fn test_format_amount_two_decimals() {
    assert_eq!(theme::format_amount(150, 2), "1.50");
    assert_eq!(theme::format_amount(1, 2), "0.01");
}

#[test]
fn test_screen_labels() {
    assert_eq!(Screen::Dashboard.label(), "Dashboard");
    assert_eq!(Screen::Operations.label(), "Operations");
    assert_eq!(Screen::Roles.label(), "Roles");
    assert_eq!(Screen::Compliance.label(), "Compliance");
    assert_eq!(Screen::Events.label(), "Events");
    assert_eq!(Screen::Holders.label(), "Holders");
}

#[test]
fn test_screen_from_index() {
    assert_eq!(Screen::from_index(0), Some(Screen::Dashboard));
    assert_eq!(Screen::from_index(5), Some(Screen::Holders));
    assert_eq!(Screen::from_index(6), None);
}
