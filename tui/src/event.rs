use crossterm::event::{self, Event as CtEvent, KeyEvent};
use std::time::Duration;
use tokio::sync::mpsc;

use crate::accounts::StablecoinConfig;
use crate::events::EventData;

/// All events the app loop can receive.
#[derive(Debug)]
pub enum AppEvent {
    /// Keyboard / mouse / resize from crossterm
    Key(KeyEvent),
    Resize(u16, u16),
    /// Periodic refresh tick
    Tick,
    /// Fresh on-chain data fetched
    RpcUpdate(Box<RpcData>),
    /// WebSocket event parsed
    WsEvent(EventData),
    /// Transaction result (success sig or error message)
    TxResult(std::result::Result<String, String>),
}

/// Bundled on-chain data from a refresh cycle.
#[derive(Debug, Default)]
pub struct RpcData {
    pub config: Option<StablecoinConfig>,
    pub token_name: Option<String>,
    pub token_symbol: Option<String>,
    pub minters: Vec<crate::accounts::MinterConfig>,
    pub roles: Vec<crate::accounts::RoleAssignment>,
    pub blacklist: Vec<crate::accounts::BlacklistEntry>,
    pub holders: Vec<crate::rpc::HolderInfo>,
    pub supply: Option<u64>,
}

pub struct EventLoop {
    pub tx: mpsc::UnboundedSender<AppEvent>,
    pub rx: mpsc::UnboundedReceiver<AppEvent>,
}

impl EventLoop {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self { tx, rx }
    }

    /// Spawn the crossterm event reader (blocking → spawn_blocking).
    pub fn spawn_crossterm(&self) {
        let tx = self.tx.clone();
        tokio::task::spawn_blocking(move || loop {
            if event::poll(Duration::from_millis(50)).unwrap_or(false) {
                if let Ok(evt) = event::read() {
                    let app_evt = match evt {
                        CtEvent::Key(k) => AppEvent::Key(k),
                        CtEvent::Resize(w, h) => AppEvent::Resize(w, h),
                        _ => continue,
                    };
                    if tx.send(app_evt).is_err() {
                        break;
                    }
                }
            }
        });
    }

    /// Spawn the tick timer.
    pub fn spawn_tick(&self, interval: Duration) {
        let tx = self.tx.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            loop {
                ticker.tick().await;
                if tx.send(AppEvent::Tick).is_err() {
                    break;
                }
            }
        });
    }
}
