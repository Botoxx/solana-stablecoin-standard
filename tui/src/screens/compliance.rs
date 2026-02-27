use crossterm::event::KeyCode;
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table},
    Frame,
};

use crate::app::{App, ComplianceMode, ConfirmAction, ConfirmDialog, InputMode, Toast};
use crate::theme;
use crate::widgets::input_field;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    if !app.is_sss2() {
        let block = Block::default()
            .title(Span::styled(" Compliance ", theme::bold()))
            .borders(Borders::ALL)
            .border_style(theme::border());

        let msg = Paragraph::new(vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Compliance features not enabled (SSS-1 config)",
                theme::warning(),
            )),
            Line::from(Span::styled(
                "  Initialize with transfer_hook=true for SSS-2",
                theme::dim(),
            )),
        ])
        .block(block);

        f.render_widget(msg, area);
        return;
    }

    // When editing blacklist (focus 0 or 1 = address/reason), show add form
    // When editing seize (focus 0 or 2 = wallet/amount), show seize panel
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
        .split(area);

    render_blacklist_table(f, app, chunks[0]);
    render_seize_panel(f, app, chunks[1]);
}

fn render_blacklist_table(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Blacklist ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    if app.blacklist.is_empty() {
        f.render_widget(
            Paragraph::new(Span::styled("  No blacklisted addresses", theme::dim())).block(block),
            area,
        );
        return;
    }

    let header = Row::new(vec![
        Cell::from(Span::styled("Address", theme::dim())),
        Cell::from(Span::styled("Reason", theme::dim())),
        Cell::from(Span::styled("Active", theme::dim())),
    ]);

    let rows: Vec<Row> = app
        .blacklist
        .iter()
        .enumerate()
        .map(|(i, entry)| {
            let style = if i == app.compliance_selected {
                theme::selected()
            } else {
                theme::base()
            };
            let active_style = if entry.active {
                theme::danger()
            } else {
                theme::dim()
            };
            Row::new(vec![
                Cell::from(Span::styled(
                    theme::truncate_pubkey(&entry.address.to_string(), 4),
                    style,
                )),
                Cell::from(Span::styled(&entry.reason, style)),
                Cell::from(Span::styled(
                    if entry.active { "YES" } else { "no" },
                    active_style,
                )),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(14),
            Constraint::Min(20),
            Constraint::Length(8),
        ],
    )
    .header(header)
    .block(block);

    f.render_widget(table, area);
}

fn render_seize_panel(f: &mut Frame, app: &App, area: Rect) {
    let is_blacklist = app.compliance_mode == ComplianceMode::Blacklist;

    let title = if app.input_mode.is_editing() && is_blacklist {
        " Add to Blacklist "
    } else if app.input_mode.is_editing() {
        " Seize Tokens "
    } else {
        " Actions "
    };

    let block = Block::default()
        .title(Span::styled(title, theme::bold()))
        .borders(Borders::ALL)
        .border_style(if app.input_mode.is_editing() {
            theme::accent()
        } else {
            theme::border()
        });

    let inner = block.inner(area);
    f.render_widget(block, area);

    if !app.input_mode.is_editing()
        && !app
            .config
            .as_ref()
            .map(|c| c.enable_permanent_delegate)
            .unwrap_or(false)
    {
        f.render_widget(
            Paragraph::new(Span::styled(
                "  Permanent delegate not enabled",
                theme::warning(),
            )),
            inner,
        );
        return;
    }

    let fields = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(2),
            Constraint::Min(1),
        ])
        .split(inner);

    let wallet = app
        .compliance_fields
        .first()
        .map(|s| s.as_str())
        .unwrap_or("");

    input_field::render(
        f,
        wallet,
        "Address",
        app.compliance_focus == 0 && app.input_mode.is_editing(),
        input_field::is_valid_pubkey(wallet),
        fields[0],
    );

    if is_blacklist {
        let reason = app
            .compliance_fields
            .get(1)
            .map(|s| s.as_str())
            .unwrap_or("");
        input_field::render(
            f,
            reason,
            "Reason",
            app.compliance_focus == 1 && app.input_mode.is_editing(),
            !reason.is_empty() || app.compliance_focus != 1,
            fields[1],
        );
    } else {
        let amount = app
            .compliance_fields
            .get(2)
            .map(|s| s.as_str())
            .unwrap_or("");
        input_field::render(
            f,
            amount,
            "Amount to Seize",
            app.compliance_focus == 2 && app.input_mode.is_editing(),
            input_field::is_valid_amount(amount),
            fields[1],
        );
    }

    let hint = if app.input_mode.is_editing() {
        "Tab: next | Enter: submit | Esc: cancel"
    } else {
        "s: seize | a: add blacklist | d: remove blacklist | j/k: navigate"
    };
    f.render_widget(
        Paragraph::new(Span::styled(format!("  {hint}"), theme::dim())),
        fields[2],
    );
}

pub fn handle_input(app: &mut App, key: crossterm::event::KeyEvent) {
    if app.input_mode == InputMode::Editing {
        match key.code {
            KeyCode::Tab => {
                // Blacklist: toggle 0 (address) ↔ 1 (reason)
                // Seize: toggle 0 (address) ↔ 2 (amount)
                if app.compliance_mode == ComplianceMode::Blacklist {
                    app.compliance_focus = if app.compliance_focus == 0 { 1 } else { 0 };
                } else {
                    app.compliance_focus = if app.compliance_focus == 0 { 2 } else { 0 };
                }
            }
            KeyCode::Enter => submit_compliance_action(app),
            other => {
                if let Some(field) = app.compliance_fields.get_mut(app.compliance_focus) {
                    input_field::handle_key(field, other);
                }
            }
        }
        return;
    }

    match key.code {
        KeyCode::Char('j') | KeyCode::Down => {
            if !app.blacklist.is_empty() {
                app.compliance_selected =
                    (app.compliance_selected + 1).min(app.blacklist.len() - 1);
            }
        }
        KeyCode::Char('k') | KeyCode::Up => {
            app.compliance_selected = app.compliance_selected.saturating_sub(1);
        }
        KeyCode::Char('a') => {
            // Add to blacklist: enter address + reason
            app.compliance_fields = vec![String::new(); 3];
            app.compliance_focus = 0;
            app.compliance_mode = ComplianceMode::Blacklist;
            app.input_mode = InputMode::Editing;
        }
        KeyCode::Char('d') => {
            // Remove selected from blacklist
            if let Some(entry) = app.blacklist.get(app.compliance_selected) {
                if entry.active {
                    app.confirm = Some(ConfirmDialog {
                        title: "Remove from Blacklist".into(),
                        body: format!(
                            "Remove {} from blacklist",
                            theme::truncate_pubkey(&entry.address.to_string(), 6)
                        ),
                        on_confirm: ConfirmAction::RemoveBlacklist {
                            address: entry.address.to_string(),
                        },
                        selected: true,
                    });
                } else {
                    app.set_toast(Toast::error("Entry already inactive"));
                }
            } else {
                app.set_toast(Toast::error("No entry selected"));
            }
        }
        KeyCode::Char('s') => {
            // Seize flow: edit wallet + amount
            app.compliance_fields = vec![String::new(); 3];
            app.compliance_focus = 0;
            app.compliance_mode = ComplianceMode::Seize;
            app.input_mode = InputMode::Editing;
        }
        _ => {}
    }
}

fn submit_compliance_action(app: &mut App) {
    let address = app.compliance_fields.first().cloned().unwrap_or_default();
    let reason = app.compliance_fields.get(1).cloned().unwrap_or_default();
    let amount_str = app.compliance_fields.get(2).cloned().unwrap_or_default();

    if address.is_empty() {
        app.set_toast(Toast::error("Enter address"));
        return;
    }

    // If amount is filled, this is a seize action
    if !amount_str.is_empty() {
        let amount: u64 = match amount_str.parse() {
            Ok(a) if a > 0 => a,
            _ => {
                app.set_toast(Toast::error("Invalid amount"));
                return;
            }
        };
        app.confirm = Some(ConfirmDialog {
            title: "Seize Tokens".into(),
            body: format!("Seize {} tokens from {}", amount, &address),
            on_confirm: ConfirmAction::Seize {
                wallet: address,
                amount,
            },
            selected: true,
        });
    } else {
        // Blacklist add
        if reason.is_empty() {
            app.set_toast(Toast::error("Reason required"));
            return;
        }
        app.confirm = Some(ConfirmDialog {
            title: "Add to Blacklist".into(),
            body: format!("Blacklist {} ({})", &address, &reason),
            on_confirm: ConfirmAction::AddBlacklist { address, reason },
            selected: true,
        });
    }

    app.input_mode = InputMode::Normal;
}
