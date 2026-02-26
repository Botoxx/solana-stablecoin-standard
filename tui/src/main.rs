#![allow(clippy::result_large_err, clippy::large_enum_variant, dead_code)]

mod accounts;
mod app;
mod config;
mod error;
mod event;
mod events;
mod instructions;
mod pda;
mod pubsub;
mod rpc;
mod screens;
mod theme;
mod tui_backend;
mod widgets;

use std::time::Duration;

use clap::Parser;
use crossterm::event::{KeyCode, KeyModifiers};
use solana_sdk::signature::read_keypair_file;

use app::{App, InputMode, Screen, Toast};
use config::TuiConfig;
use event::{AppEvent, EventLoop};

#[derive(Parser)]
#[command(name = "sss-tui", about = "Interactive admin TUI for SSS stablecoins")]
struct Cli {
    /// Solana RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Solana WebSocket URL
    #[arg(long)]
    ws_url: Option<String>,

    /// Path to keypair file
    #[arg(long, short)]
    keypair: Option<String>,

    /// Config PDA address to load
    #[arg(long)]
    config_pda: Option<String>,
}

#[tokio::main]
async fn main() {
    // Install panic hook that restores terminal first
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let _ = tui_backend::restore();
        original_hook(info);
    }));

    if let Err(e) = run().await {
        let _ = tui_backend::restore();
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

async fn run() -> error::Result<()> {
    let cli = Cli::parse();

    // Load config, apply CLI overrides
    let mut cfg = TuiConfig::load().unwrap_or_default();
    cfg.apply_overrides(cli.rpc_url, cli.ws_url, cli.keypair, cli.config_pda);

    // Load keypair
    let keypair = read_keypair_file(&cfg.keypair_path).map_err(|e| {
        error::TuiError::Config(format!("Cannot read keypair {}: {}", cfg.keypair_path, e))
    })?;

    // Init terminal
    let mut terminal = tui_backend::init()?;

    // Create app + event loop
    let mut app = App::new();
    let event_loop = EventLoop::new();
    event_loop.spawn_crossterm();
    event_loop.spawn_tick(Duration::from_secs(5));

    // Create RPC client
    let rpc = rpc::SolanaRpc::new(&cfg.rpc_url);

    // If we have a config PDA, do initial fetch
    let config_pda = cfg
        .config_pda
        .as_ref()
        .and_then(|s| s.parse::<solana_sdk::pubkey::Pubkey>().ok());

    if let Some(pda) = config_pda {
        let tx = event_loop.tx.clone();
        let rpc2 = rpc.clone();
        tokio::spawn(async move {
            let data = rpc::fetch_all_data(&rpc2, &pda).await;
            let _ = tx.send(AppEvent::RpcUpdate(Box::new(data)));
        });
    }

    // Spawn WebSocket listener if we have a config PDA
    if let Some(_pda) = config_pda {
        pubsub::spawn_listener(&cfg.ws_url, event_loop.tx.clone());
    }

    let mut rx = event_loop.rx;
    let tx = event_loop.tx.clone();

    // Main loop
    while app.running {
        // Draw
        terminal.draw(|f| screens::render(f, &app))?;

        // Clear expired toast
        app.clear_expired_toast();

        // Wait for next event
        if let Some(evt) = rx.recv().await {
            match evt {
                AppEvent::Key(key) => {
                    handle_key(&mut app, key, &rpc, &keypair, &tx, &mut cfg, config_pda);
                }
                AppEvent::Resize(_, _) => {
                    // Terminal auto-resizes on next draw
                }
                AppEvent::Tick => {
                    if let Some(pda) = config_pda {
                        let tx2 = tx.clone();
                        let rpc2 = rpc.clone();
                        tokio::spawn(async move {
                            let data = rpc::fetch_all_data(&rpc2, &pda).await;
                            let _ = tx2.send(AppEvent::RpcUpdate(Box::new(data)));
                        });
                    }
                }
                AppEvent::RpcUpdate(data) => {
                    app.config = data.config;
                    app.token_name = data.token_name;
                    app.token_symbol = data.token_symbol;
                    app.minters = data.minters;
                    app.roles = data.roles;
                    app.blacklist = data.blacklist;
                    app.holders = data.holders;
                    app.supply = data.supply;
                    app.last_refresh = Some(std::time::Instant::now());
                }
                AppEvent::WsEvent(event_data) => {
                    app.ws_connected = true;
                    app.push_event(event_data);
                }
                AppEvent::TxResult(result) => {
                    app.tx_pending = false;
                    match result {
                        Ok(sig) => {
                            app.set_toast(Toast::success(format!("Tx: {}", &sig[..16])));
                            // Trigger refresh
                            if let Some(pda) = config_pda {
                                let tx2 = tx.clone();
                                let rpc2 = rpc.clone();
                                tokio::spawn(async move {
                                    tokio::time::sleep(Duration::from_secs(2)).await;
                                    let data = rpc::fetch_all_data(&rpc2, &pda).await;
                                    let _ = tx2.send(AppEvent::RpcUpdate(Box::new(data)));
                                });
                            }
                        }
                        Err(msg) => {
                            app.set_toast(Toast::error(msg));
                        }
                    }
                }
            }
        }
    }

    // Save config and restore terminal
    let _ = cfg.save();
    tui_backend::restore()?;
    Ok(())
}

fn handle_key(
    app: &mut App,
    key: crossterm::event::KeyEvent,
    rpc: &rpc::SolanaRpc,
    keypair: &solana_sdk::signer::keypair::Keypair,
    tx: &tokio::sync::mpsc::UnboundedSender<AppEvent>,
    cfg: &mut TuiConfig,
    config_pda: Option<solana_sdk::pubkey::Pubkey>,
) {
    // Global: Ctrl+C always quits
    if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
        app.running = false;
        return;
    }

    // If help overlay is shown, any key closes it
    if app.show_help {
        app.show_help = false;
        return;
    }

    // If confirm dialog is shown, handle it
    if let Some(ref mut dialog) = app.confirm {
        match key.code {
            KeyCode::Tab | KeyCode::Left | KeyCode::Right => {
                dialog.selected = !dialog.selected;
            }
            KeyCode::Enter => {
                if dialog.selected {
                    let action = dialog.on_confirm.clone();
                    app.confirm = None;
                    execute_confirm(app, action, rpc, keypair, tx, config_pda);
                } else {
                    app.confirm = None;
                }
            }
            KeyCode::Esc => {
                app.confirm = None;
            }
            _ => {}
        }
        return;
    }

    // If in editing mode, delegate to screen-specific input handler
    if app.input_mode == InputMode::Editing {
        match key.code {
            KeyCode::Esc => {
                app.input_mode = InputMode::Normal;
            }
            _ => {
                screens::handle_input(app, key, rpc, keypair, tx, cfg, config_pda);
            }
        }
        return;
    }

    // Normal mode global keys
    match key.code {
        KeyCode::Char('q') => app.running = false,
        KeyCode::Char('?') => app.show_help = true,
        KeyCode::Char('r') => {
            if let Some(pda) = config_pda {
                let tx2 = tx.clone();
                let rpc2 = rpc.clone();
                tokio::spawn(async move {
                    let data = rpc::fetch_all_data(&rpc2, &pda).await;
                    let _ = tx2.send(AppEvent::RpcUpdate(Box::new(data)));
                });
            }
        }
        KeyCode::Char('1') => app.screen = Screen::Dashboard,
        KeyCode::Char('2') => {
            app.screen = Screen::Operations;
            app.reset_ops_fields();
        }
        KeyCode::Char('3') => app.screen = Screen::Roles,
        KeyCode::Char('4') => app.screen = Screen::Compliance,
        KeyCode::Char('5') => app.screen = Screen::Events,
        KeyCode::Char('6') => app.screen = Screen::Holders,
        _ => {
            screens::handle_input(app, key, rpc, keypair, tx, cfg, config_pda);
        }
    }
}

fn execute_confirm(
    app: &mut App,
    action: app::ConfirmAction,
    rpc: &rpc::SolanaRpc,
    keypair: &solana_sdk::signer::keypair::Keypair,
    tx: &tokio::sync::mpsc::UnboundedSender<AppEvent>,
    config_pda: Option<solana_sdk::pubkey::Pubkey>,
) {
    let Some(pda) = config_pda else {
        app.set_toast(Toast::error("No config PDA set"));
        return;
    };
    let Some(ref config) = app.config else {
        app.set_toast(Toast::error("Config not loaded"));
        return;
    };

    let ix_result = instructions::build_instruction(&action, &pda, config, keypair);
    match ix_result {
        Ok(ix) => {
            app.tx_pending = true;
            let rpc2 = rpc.clone();
            let tx2 = tx.clone();
            let kp_bytes = keypair.to_bytes();
            tokio::spawn(async move {
                let kp = solana_sdk::signer::keypair::Keypair::try_from(kp_bytes.as_ref())
                    .expect("keypair roundtrip");
                let result = rpc2.send_and_confirm(&ix, &kp).await;
                let _ = tx2.send(AppEvent::TxResult(result));
            });
        }
        Err(e) => {
            app.set_toast(Toast::error(format!("{e}")));
        }
    }
}
