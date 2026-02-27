use crossterm::event::{Event as CtEvent, EventStream, KeyEvent, KeyEventKind};
use futures_util::StreamExt;
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

    /// Spawn the combined crossterm event reader + tick timer as a single async task.
    /// Uses crossterm's async EventStream — no spawn_blocking, fully cancellable.
    pub fn spawn_event_task(&self, tick_interval: Duration) {
        let tx = self.tx.clone();
        tokio::spawn(async move {
            let mut reader = EventStream::new();
            let mut tick = tokio::time::interval(tick_interval);

            loop {
                tokio::select! {
                    maybe_event = reader.next() => {
                        match maybe_event {
                            Some(Ok(CtEvent::Key(k))) if k.kind == KeyEventKind::Press => {
                                if tx.send(AppEvent::Key(k)).is_err() {
                                    break;
                                }
                            }
                            Some(Ok(CtEvent::Resize(w, h))) => {
                                if tx.send(AppEvent::Resize(w, h)).is_err() {
                                    break;
                                }
                            }
                            Some(Err(_)) | None => break,
                            _ => {} // ignore mouse, focus, paste events
                        }
                    }
                    _ = tick.tick() => {
                        if tx.send(AppEvent::Tick).is_err() {
                            break;
                        }
                    }
                }
            }
        });
    }
}
