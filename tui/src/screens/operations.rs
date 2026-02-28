use crossterm::event::KeyCode;
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Tabs},
    Frame,
};

use crate::app::{App, ConfirmAction, ConfirmDialog, InputMode, OpsTab};
use crate::theme;
use crate::widgets::input_field;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(8)])
        .split(area);

    // Sub-tabs
    let titles: Vec<Line> = OpsTab::ALL
        .iter()
        .map(|t| {
            Line::from(Span::styled(
                format!(" {} ", t.label()),
                if *t == app.ops_tab {
                    theme::tab_active()
                } else {
                    theme::tab_inactive()
                },
            ))
        })
        .collect();

    let tabs = Tabs::new(titles)
        .block(
            Block::default()
                .borders(Borders::BOTTOM)
                .border_style(theme::border())
                .title(Span::styled(" Operations ", theme::bold())),
        )
        .select(app.ops_tab as usize)
        .highlight_style(theme::tab_active());

    f.render_widget(tabs, chunks[0]);

    let content = chunks[1];

    match app.ops_tab {
        OpsTab::Mint => render_mint_form(f, app, content),
        OpsTab::Burn => render_burn_form(f, app, content),
        OpsTab::Freeze => render_single_wallet_form(f, app, content, "Freeze Account"),
        OpsTab::Thaw => render_single_wallet_form(f, app, content, "Thaw Account"),
        OpsTab::Pause => render_pause_toggle(f, app, content),
    }
}

fn render_mint_form(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Mint Tokens ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    let inner = block.inner(area);
    f.render_widget(block, area);

    let fields = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(2),
            Constraint::Min(1),
        ])
        .split(inner);

    let recipient = app.ops_fields.first().map(|s| s.as_str()).unwrap_or("");
    let amount = app.ops_fields.get(1).map(|s| s.as_str()).unwrap_or("");

    input_field::render(
        f,
        recipient,
        "Recipient Wallet",
        app.ops_focus == 0 && app.input_mode == InputMode::Editing,
        input_field::is_valid_pubkey(recipient),
        fields[0],
    );

    input_field::render(
        f,
        amount,
        "Amount (raw units)",
        app.ops_focus == 1 && app.input_mode == InputMode::Editing,
        input_field::is_valid_amount(amount),
        fields[1],
    );

    let hint = if app.input_mode == InputMode::Editing {
        "Tab: next field | Enter: submit | Esc: cancel"
    } else {
        "e/i: edit | Tab: switch sub-tab"
    };
    f.render_widget(
        Paragraph::new(Span::styled(format!("  {hint}"), theme::dim())),
        fields[2],
    );
}

fn render_burn_form(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Burn Tokens ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    let inner = block.inner(area);
    f.render_widget(block, area);

    let fields = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(2),
            Constraint::Min(1),
        ])
        .split(inner);

    let source = app.ops_fields.first().map(|s| s.as_str()).unwrap_or("");
    let amount = app.ops_fields.get(1).map(|s| s.as_str()).unwrap_or("");

    input_field::render(
        f,
        source,
        "Source Wallet (empty=self)",
        app.ops_focus == 0 && app.input_mode == InputMode::Editing,
        source.is_empty() || input_field::is_valid_pubkey(source),
        fields[0],
    );

    input_field::render(
        f,
        amount,
        "Amount (raw units)",
        app.ops_focus == 1 && app.input_mode == InputMode::Editing,
        input_field::is_valid_amount(amount),
        fields[1],
    );

    let hint = if app.input_mode == InputMode::Editing {
        "Tab: next field | Enter: submit | Esc: cancel"
    } else {
        "e/i: edit | Tab: switch sub-tab"
    };
    f.render_widget(
        Paragraph::new(Span::styled(format!("  {hint}"), theme::dim())),
        fields[2],
    );
}

fn render_single_wallet_form(f: &mut Frame, app: &App, area: Rect, title: &str) {
    let block = Block::default()
        .title(Span::styled(format!(" {title} "), theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    let inner = block.inner(area);
    f.render_widget(block, area);

    let fields = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(2),
            Constraint::Min(1),
        ])
        .split(inner);

    let wallet = app.ops_fields.first().map(|s| s.as_str()).unwrap_or("");

    input_field::render(
        f,
        wallet,
        "Wallet Address",
        app.ops_focus == 0 && app.input_mode == InputMode::Editing,
        input_field::is_valid_pubkey(wallet),
        fields[0],
    );

    let hint = if app.input_mode == InputMode::Editing {
        "Enter: submit | Esc: cancel"
    } else {
        "e/i: edit"
    };
    f.render_widget(
        Paragraph::new(Span::styled(format!("  {hint}"), theme::dim())),
        fields[1],
    );
}

fn render_pause_toggle(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Pause / Unpause ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    let paused = app.is_paused();
    let status = if paused { "PAUSED" } else { "ACTIVE" };
    let style = if paused {
        theme::danger()
    } else {
        theme::accent()
    };
    let action = if paused {
        "Press Enter to UNPAUSE"
    } else {
        "Press Enter to PAUSE"
    };

    let lines = vec![
        Line::from(""),
        Line::from(vec![
            Span::styled("  Current state: ", theme::dim()),
            Span::styled(status, style),
        ]),
        Line::from(""),
        Line::from(Span::styled(format!("  {action}"), theme::bold())),
    ];

    f.render_widget(Paragraph::new(lines).block(block), area);
}

pub fn handle_input(app: &mut App, key: crossterm::event::KeyEvent) {
    if app.input_mode == InputMode::Editing {
        match key.code {
            KeyCode::Tab => {
                let max = match app.ops_tab {
                    OpsTab::Mint | OpsTab::Burn => 1,
                    _ => 0,
                };
                app.ops_focus = if app.ops_focus >= max {
                    0
                } else {
                    app.ops_focus + 1
                };
            }
            KeyCode::BackTab => {
                let max = match app.ops_tab {
                    OpsTab::Mint | OpsTab::Burn => 1,
                    _ => 0,
                };
                app.ops_focus = if app.ops_focus == 0 {
                    max
                } else {
                    app.ops_focus - 1
                };
            }
            KeyCode::Enter => {
                submit_operation(app);
            }
            other => {
                if let Some(field) = app.ops_fields.get_mut(app.ops_focus) {
                    input_field::handle_key(field, other);
                }
            }
        }
        return;
    }

    // Normal mode
    match key.code {
        KeyCode::Char('e') | KeyCode::Char('i') => {
            if app.ops_tab == OpsTab::Pause {
                // No editing needed for pause toggle
            } else {
                app.input_mode = InputMode::Editing;
            }
        }
        KeyCode::Tab => {
            let idx = app.ops_tab as usize;
            let next = (idx + 1) % OpsTab::ALL.len();
            app.ops_tab = OpsTab::ALL[next];
            app.reset_ops_fields();
        }
        KeyCode::BackTab => {
            let idx = app.ops_tab as usize;
            let prev = if idx == 0 { OpsTab::ALL.len() - 1 } else { idx - 1 };
            app.ops_tab = OpsTab::ALL[prev];
            app.reset_ops_fields();
        }
        KeyCode::Enter => {
            if app.ops_tab == OpsTab::Pause {
                submit_operation(app);
            }
        }
        _ => {}
    }
}

fn submit_operation(app: &mut App) {
    let action = match app.ops_tab {
        OpsTab::Mint => {
            let recipient = app.ops_fields.first().cloned().unwrap_or_default();
            let amount_str = app.ops_fields.get(1).cloned().unwrap_or_default();
            if recipient.is_empty() || amount_str.is_empty() {
                app.set_toast(crate::app::Toast::error("Fill all fields"));
                return;
            }
            let amount = match amount_str.parse::<u64>() {
                Ok(a) if a > 0 => a,
                _ => {
                    app.set_toast(crate::app::Toast::error("Invalid amount"));
                    return;
                }
            };
            ConfirmAction::Mint { recipient, amount }
        }
        OpsTab::Burn => {
            let source = app.ops_fields.first().cloned().unwrap_or_default();
            let amount_str = app.ops_fields.get(1).cloned().unwrap_or_default();
            if amount_str.is_empty() {
                app.set_toast(crate::app::Toast::error("Enter amount"));
                return;
            }
            let amount = match amount_str.parse::<u64>() {
                Ok(a) if a > 0 => a,
                _ => {
                    app.set_toast(crate::app::Toast::error("Invalid amount"));
                    return;
                }
            };
            ConfirmAction::Burn {
                source: if source.is_empty() {
                    None
                } else {
                    Some(source)
                },
                amount,
            }
        }
        OpsTab::Freeze => {
            let wallet = app.ops_fields.first().cloned().unwrap_or_default();
            if wallet.is_empty() {
                app.set_toast(crate::app::Toast::error("Enter wallet address"));
                return;
            }
            ConfirmAction::Freeze { wallet }
        }
        OpsTab::Thaw => {
            let wallet = app.ops_fields.first().cloned().unwrap_or_default();
            if wallet.is_empty() {
                app.set_toast(crate::app::Toast::error("Enter wallet address"));
                return;
            }
            ConfirmAction::Thaw { wallet }
        }
        OpsTab::Pause => {
            if app.is_paused() {
                ConfirmAction::Unpause
            } else {
                ConfirmAction::Pause
            }
        }
    };

    let title = match &action {
        ConfirmAction::Mint { .. } => "Confirm Mint",
        ConfirmAction::Burn { .. } => "Confirm Burn",
        ConfirmAction::Freeze { .. } => "Confirm Freeze",
        ConfirmAction::Thaw { .. } => "Confirm Thaw",
        ConfirmAction::Pause => "Confirm Pause",
        ConfirmAction::Unpause => "Confirm Unpause",
        _ => "Confirm",
    };

    let body = match &action {
        ConfirmAction::Mint { recipient, amount } => {
            format!("Mint {amount} tokens to {recipient}")
        }
        ConfirmAction::Burn { source, amount } => {
            let src = source.as_deref().unwrap_or("self");
            format!("Burn {amount} tokens from {src}")
        }
        ConfirmAction::Freeze { wallet } => format!("Freeze account: {wallet}"),
        ConfirmAction::Thaw { wallet } => format!("Thaw account: {wallet}"),
        ConfirmAction::Pause => "Pause the system".into(),
        ConfirmAction::Unpause => "Unpause the system".into(),
        _ => String::new(),
    };

    app.confirm = Some(ConfirmDialog {
        title: title.into(),
        body,
        on_confirm: action,
        selected: true,
    });
    app.input_mode = InputMode::Normal;
}
