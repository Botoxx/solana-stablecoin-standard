use std::collections::VecDeque;
use std::time::Instant;

use crate::accounts::{BlacklistEntry, MinterConfig, RoleAssignment, StablecoinConfig};
use crate::events::EventData;
use crate::rpc::HolderInfo;

/// Which screen is active.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Screen {
    Dashboard = 0,
    Operations = 1,
    Roles = 2,
    Compliance = 3,
    Events = 4,
    Holders = 5,
}

impl Screen {
    pub const ALL: [Screen; 6] = [
        Screen::Dashboard,
        Screen::Operations,
        Screen::Roles,
        Screen::Compliance,
        Screen::Events,
        Screen::Holders,
    ];

    pub fn label(&self) -> &'static str {
        match self {
            Screen::Dashboard => "Dashboard",
            Screen::Operations => "Operations",
            Screen::Roles => "Roles",
            Screen::Compliance => "Compliance",
            Screen::Events => "Events",
            Screen::Holders => "Holders",
        }
    }

    pub fn from_index(i: usize) -> Option<Self> {
        Screen::ALL.get(i).copied()
    }
}

/// Input mode for the app.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    Normal,
    Editing,
}

/// Toast notification.
#[derive(Debug, Clone)]
pub struct Toast {
    pub message: String,
    pub is_error: bool,
    pub created: Instant,
}

impl Toast {
    pub fn success(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            is_error: false,
            created: Instant::now(),
        }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
            is_error: true,
            created: Instant::now(),
        }
    }

    pub fn is_expired(&self) -> bool {
        self.created.elapsed().as_secs() >= 5
    }
}

/// Confirmation dialog state.
#[derive(Debug, Clone)]
pub struct ConfirmDialog {
    pub title: String,
    pub body: String,
    pub on_confirm: ConfirmAction,
    pub selected: bool, // true = Confirm, false = Cancel
}

/// What action a confirm dialog triggers.
#[derive(Debug, Clone)]
#[allow(clippy::large_enum_variant)]
pub enum ConfirmAction {
    Mint { recipient: String, amount: u64 },
    Burn { source: Option<String>, amount: u64 },
    Freeze { wallet: String },
    Thaw { wallet: String },
    Pause,
    Unpause,
    AssignRole { address: String, role_type: u8 },
    RevokeRole { address: String, role_type: u8 },
    AddMinter { address: String, quota: u64 },
    UpdateQuota { address: String, new_quota: u64 },
    RemoveMinter { address: String },
    AddBlacklist { address: String, reason: String },
    RemoveBlacklist { address: String },
    Seize { wallet: String, amount: u64 },
}

/// Operations sub-tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpsTab {
    Mint = 0,
    Burn = 1,
    Freeze = 2,
    Thaw = 3,
    Pause = 4,
}

impl OpsTab {
    pub const ALL: [OpsTab; 5] = [
        OpsTab::Mint,
        OpsTab::Burn,
        OpsTab::Freeze,
        OpsTab::Thaw,
        OpsTab::Pause,
    ];

    pub fn label(&self) -> &'static str {
        match self {
            OpsTab::Mint => "Mint",
            OpsTab::Burn => "Burn",
            OpsTab::Freeze => "Freeze",
            OpsTab::Thaw => "Thaw",
            OpsTab::Pause => "Pause",
        }
    }
}

/// Roles sub-tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RolesTab {
    Roles = 0,
    Minters = 1,
}

/// Application state.
pub struct App {
    pub running: bool,
    pub screen: Screen,
    pub input_mode: InputMode,

    // Cached on-chain data
    pub config: Option<StablecoinConfig>,
    pub token_name: Option<String>,
    pub token_symbol: Option<String>,
    pub minters: Vec<MinterConfig>,
    pub roles: Vec<RoleAssignment>,
    pub blacklist: Vec<BlacklistEntry>,
    pub holders: Vec<HolderInfo>,
    pub supply: Option<u64>,
    pub events: VecDeque<EventData>,
    pub last_refresh: Option<Instant>,
    pub ws_connected: bool,

    // UI state
    pub toast: Option<Toast>,
    pub confirm: Option<ConfirmDialog>,
    pub show_help: bool,

    // Operations screen
    pub ops_tab: OpsTab,
    pub ops_fields: Vec<String>, // input field values
    pub ops_focus: usize,        // which field is focused

    // Roles screen
    pub roles_tab: RolesTab,
    pub roles_fields: Vec<String>,
    pub roles_focus: usize,
    pub roles_selected: usize, // table row

    // Compliance screen
    pub compliance_fields: Vec<String>,
    pub compliance_focus: usize,
    pub compliance_selected: usize,

    // Events screen
    pub events_scroll: usize,
    pub events_auto_scroll: bool,
    pub events_filter: Option<String>,

    // Holders screen
    pub holders_selected: usize,

    // Pending tx indicator
    pub tx_pending: bool,
}

impl App {
    pub fn new() -> Self {
        Self {
            running: true,
            screen: Screen::Dashboard,
            input_mode: InputMode::Normal,
            config: None,
            token_name: None,
            token_symbol: None,
            minters: Vec::new(),
            roles: Vec::new(),
            blacklist: Vec::new(),
            holders: Vec::new(),
            supply: None,
            events: VecDeque::with_capacity(500),
            last_refresh: None,
            ws_connected: false,
            toast: None,
            confirm: None,
            show_help: false,
            ops_tab: OpsTab::Mint,
            ops_fields: vec![String::new(); 2], // recipient, amount
            ops_focus: 0,
            roles_tab: RolesTab::Roles,
            roles_fields: vec![String::new(); 3], // address, role_type, quota
            roles_focus: 0,
            roles_selected: 0,
            compliance_fields: vec![String::new(); 3], // address, reason, seize_amount
            compliance_focus: 0,
            compliance_selected: 0,
            events_scroll: 0,
            events_auto_scroll: true,
            events_filter: None,
            holders_selected: 0,
            tx_pending: false,
        }
    }

    pub fn push_event(&mut self, event: EventData) {
        if self.events.len() >= 500 {
            self.events.pop_front();
        }
        self.events.push_back(event);
        if self.events_auto_scroll {
            self.events_scroll = self.events.len().saturating_sub(1);
        }
    }

    pub fn set_toast(&mut self, toast: Toast) {
        self.toast = Some(toast);
    }

    pub fn clear_expired_toast(&mut self) {
        if let Some(ref t) = self.toast {
            if t.is_expired() {
                self.toast = None;
            }
        }
    }

    /// Reset input fields when switching ops sub-tabs.
    pub fn reset_ops_fields(&mut self) {
        self.ops_fields = vec![String::new(); 2];
        self.ops_focus = 0;
    }

    /// Is this an SSS-2 (compliance-enabled) config?
    pub fn is_sss2(&self) -> bool {
        self.config
            .as_ref()
            .map(|c| c.enable_transfer_hook)
            .unwrap_or(false)
    }

    pub fn is_paused(&self) -> bool {
        self.config.as_ref().map(|c| c.paused).unwrap_or(false)
    }
}
