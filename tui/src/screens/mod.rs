mod compliance;
mod dashboard;
mod events;
mod holders;
mod operations;
mod roles;

use crossterm::event::KeyEvent;
use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::Frame;
use solana_sdk::signer::keypair::Keypair;
use tokio::sync::mpsc;

use crate::app::{App, Screen};
use crate::config::TuiConfig;
use crate::event::AppEvent;
use crate::rpc::SolanaRpc;
use crate::widgets;

pub fn render(f: &mut Frame, app: &App) {
    let size = f.area();

    // Main layout: tab_bar (3) | content (remaining) | status_bar (3)
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(10),
            Constraint::Length(3),
        ])
        .split(size);

    // Tab bar
    widgets::tab_bar::render(f, app, chunks[0]);

    // Screen content
    let content_area = chunks[1];
    match app.screen {
        Screen::Dashboard => dashboard::render(f, app, content_area),
        Screen::Operations => operations::render(f, app, content_area),
        Screen::Roles => roles::render(f, app, content_area),
        Screen::Compliance => compliance::render(f, app, content_area),
        Screen::Events => events::render(f, app, content_area),
        Screen::Holders => holders::render(f, app, content_area),
    }

    // Status bar
    widgets::status_bar::render(f, app, chunks[2]);

    // Toast overlay
    widgets::toast::render(f, app);

    // Confirm dialog overlay
    widgets::confirm::render(f, app);

    // Help overlay
    if app.show_help {
        widgets::help::render(f);
    }
}

pub fn handle_input(
    app: &mut App,
    key: KeyEvent,
    _rpc: &SolanaRpc,
    _keypair: &Keypair,
    _tx: &mpsc::UnboundedSender<AppEvent>,
    _cfg: &mut TuiConfig,
    _config_pda: Option<solana_sdk::pubkey::Pubkey>,
) {
    match app.screen {
        Screen::Dashboard => {}
        Screen::Operations => operations::handle_input(app, key),
        Screen::Roles => roles::handle_input(app, key),
        Screen::Compliance => compliance::handle_input(app, key),
        Screen::Events => events::handle_input(app, key),
        Screen::Holders => holders::handle_input(app, key),
    }
}
