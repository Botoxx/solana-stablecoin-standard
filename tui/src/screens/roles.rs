use crossterm::event::KeyCode;
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table},
    Frame,
};

use crate::accounts::role_name;
use crate::app::{App, ConfirmAction, ConfirmDialog, InputMode, RolesTab, Toast};
use crate::theme;
use crate::widgets::{input_field, quota_bar};

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    if app.input_mode == InputMode::Editing {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
            .split(area);

        render_edit_form(f, app, chunks[0]);
        if app.roles_tab == RolesTab::Minters {
            render_minters_table(f, app, chunks[1]);
        } else {
            render_roles_table(f, app, chunks[1]);
        }
        return;
    }

    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    render_roles_table(f, app, chunks[0]);
    render_minters_table(f, app, chunks[1]);
}

fn render_edit_form(f: &mut Frame, app: &App, area: Rect) {
    let title = if app.roles_tab == RolesTab::Minters {
        " Add Minter "
    } else {
        " Assign Role "
    };

    let block = Block::default()
        .title(Span::styled(title, theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::accent());

    let inner = block.inner(area);
    f.render_widget(block, area);

    let field_count = if app.roles_tab == RolesTab::Minters { 3 } else { 3 };
    let constraints: Vec<Constraint> = (0..field_count)
        .map(|_| Constraint::Length(3))
        .chain(std::iter::once(Constraint::Length(2)))
        .chain(std::iter::once(Constraint::Min(1)))
        .collect();

    let fields = Layout::default()
        .direction(Direction::Vertical)
        .constraints(constraints)
        .split(inner);

    let address = app.roles_fields.first().map(|s| s.as_str()).unwrap_or("");
    input_field::render(
        f,
        address,
        "Wallet Address",
        app.roles_focus == 0,
        input_field::is_valid_pubkey(address),
        fields[0],
    );

    if app.roles_tab == RolesTab::Minters {
        let quota = app.roles_fields.get(2).map(|s| s.as_str()).unwrap_or("");
        input_field::render(
            f,
            quota,
            "Quota (raw units)",
            app.roles_focus == 2,
            input_field::is_valid_amount(quota),
            fields[1],
        );

        let hint = "Tab: next field | Enter: submit | Esc: cancel";
        f.render_widget(
            Paragraph::new(Span::styled(format!("  {hint}"), theme::dim())),
            fields[2],
        );
    } else {
        let role_type = app.roles_fields.get(1).map(|s| s.as_str()).unwrap_or("");
        input_field::render(
            f,
            role_type,
            "Role (0-4 or minter/burner/pauser/blacklister/seizer)",
            app.roles_focus == 1,
            matches!(role_type, "0" | "1" | "2" | "3" | "4" | "minter" | "burner" | "pauser" | "blacklister" | "seizer" | ""),
            fields[1],
        );

        let hint = "Tab: next field | Enter: submit | Esc: cancel";
        f.render_widget(
            Paragraph::new(Span::styled(format!("  {hint}"), theme::dim())),
            fields[2],
        );
    }
}

fn render_roles_table(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Roles ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(if app.roles_tab == RolesTab::Roles {
            theme::accent()
        } else {
            theme::border()
        });

    if app.roles.is_empty() {
        f.render_widget(
            Paragraph::new(Span::styled("  No roles assigned", theme::dim())).block(block),
            area,
        );
        return;
    }

    let header = Row::new(vec![
        Cell::from(Span::styled("Address", theme::dim())),
        Cell::from(Span::styled("Role", theme::dim())),
        Cell::from(Span::styled("Assigned By", theme::dim())),
    ])
    .height(1);

    let rows: Vec<Row> = app
        .roles
        .iter()
        .enumerate()
        .map(|(i, role)| {
            let style = if i == app.roles_selected && app.roles_tab == RolesTab::Roles {
                theme::selected()
            } else {
                theme::base()
            };
            Row::new(vec![
                Cell::from(Span::styled(
                    theme::truncate_pubkey(&role.address.to_string(), 4),
                    style,
                )),
                Cell::from(Span::styled(role_name(role.role_type), style)),
                Cell::from(Span::styled(
                    theme::truncate_pubkey(&role.assigned_by.to_string(), 4),
                    style,
                )),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(14),
            Constraint::Length(12),
            Constraint::Min(14),
        ],
    )
    .header(header)
    .block(block);

    f.render_widget(table, area);
}

fn render_minters_table(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Minters ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(if app.roles_tab == RolesTab::Minters {
            theme::accent()
        } else {
            theme::border()
        });

    if app.minters.is_empty() {
        f.render_widget(
            Paragraph::new(Span::styled("  No minters configured", theme::dim())).block(block),
            area,
        );
        return;
    }

    let inner = block.inner(area);
    f.render_widget(block, area);

    // Header
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints(
            std::iter::once(Constraint::Length(1))
                .chain(
                    app.minters
                        .iter()
                        .take((inner.height as usize).saturating_sub(1) / 2)
                        .map(|_| Constraint::Length(2)),
                )
                .collect::<Vec<_>>(),
        )
        .split(inner);

    let header = Line::from(vec![
        Span::styled(" Address          ", theme::dim()),
        Span::styled("Quota", theme::dim()),
    ]);
    f.render_widget(Paragraph::new(header), rows[0]);

    for (i, minter) in app.minters.iter().enumerate() {
        let row_idx = i + 1;
        if row_idx >= rows.len() {
            break;
        }

        let minter_rows = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(1), Constraint::Length(1)])
            .split(rows[row_idx]);

        let label = Line::from(Span::styled(
            format!(" {}", theme::truncate_pubkey(&minter.minter.to_string(), 6)),
            theme::base(),
        ));
        f.render_widget(Paragraph::new(label), minter_rows[0]);

        let used = minter.quota_total.saturating_sub(minter.quota_remaining);
        quota_bar::render(f, used, minter.quota_total, minter_rows[1]);
    }
}

pub fn handle_input(app: &mut App, key: crossterm::event::KeyEvent) {
    if app.input_mode == InputMode::Editing {
        match key.code {
            KeyCode::Tab => {
                let max = if app.roles_tab == RolesTab::Minters {
                    2
                } else {
                    1
                };
                app.roles_focus = (app.roles_focus + 1) % (max + 1);
            }
            KeyCode::Enter => submit_role_action(app),
            other => {
                if let Some(field) = app.roles_fields.get_mut(app.roles_focus) {
                    input_field::handle_key(field, other);
                }
            }
        }
        return;
    }

    match key.code {
        KeyCode::Tab => {
            app.roles_tab = match app.roles_tab {
                RolesTab::Roles => RolesTab::Minters,
                RolesTab::Minters => RolesTab::Roles,
            };
        }
        KeyCode::Char('j') | KeyCode::Down => {
            if app.roles_tab == RolesTab::Roles && !app.roles.is_empty() {
                app.roles_selected = (app.roles_selected + 1).min(app.roles.len() - 1);
            }
        }
        KeyCode::Char('k') | KeyCode::Up => {
            if app.roles_tab == RolesTab::Roles {
                app.roles_selected = app.roles_selected.saturating_sub(1);
            }
        }
        KeyCode::Char('a') => {
            app.roles_fields = vec![String::new(); 3];
            app.roles_focus = 0;
            app.input_mode = InputMode::Editing;
        }
        KeyCode::Char('d') => {
            if app.roles_tab == RolesTab::Roles {
                // Revoke selected role
                if let Some(role) = app.roles.get(app.roles_selected) {
                    app.confirm = Some(ConfirmDialog {
                        title: "Revoke Role".into(),
                        body: format!(
                            "Revoke {} role from {}",
                            role_name(role.role_type),
                            theme::truncate_pubkey(&role.address.to_string(), 6)
                        ),
                        on_confirm: ConfirmAction::RevokeRole {
                            address: role.address.to_string(),
                            role_type: role.role_type,
                        },
                        selected: true,
                    });
                }
            } else if app.roles_tab == RolesTab::Minters {
                // Remove selected minter
                if let Some(minter) = app.minters.get(app.roles_selected) {
                    app.confirm = Some(ConfirmDialog {
                        title: "Remove Minter".into(),
                        body: format!(
                            "Remove minter {}",
                            theme::truncate_pubkey(&minter.minter.to_string(), 6)
                        ),
                        on_confirm: ConfirmAction::RemoveMinter {
                            address: minter.minter.to_string(),
                        },
                        selected: true,
                    });
                }
            }
        }
        _ => {}
    }
}

fn submit_role_action(app: &mut App) {
    let address = app.roles_fields.first().cloned().unwrap_or_default();
    if address.is_empty() {
        app.set_toast(Toast::error("Enter address"));
        return;
    }

    match app.roles_tab {
        RolesTab::Roles => {
            let role_str = app.roles_fields.get(1).cloned().unwrap_or_default();
            let role_type: u8 = match role_str.as_str() {
                "0" | "minter" => 0,
                "1" | "burner" => 1,
                "2" | "pauser" => 2,
                "3" | "blacklister" => 3,
                "4" | "seizer" => 4,
                _ => {
                    app.set_toast(Toast::error("Role: 0-4 or name"));
                    return;
                }
            };
            app.confirm = Some(ConfirmDialog {
                title: "Assign Role".into(),
                body: format!("Assign {} to {}", role_name(role_type), &address),
                on_confirm: ConfirmAction::AssignRole { address, role_type },
                selected: true,
            });
        }
        RolesTab::Minters => {
            let quota_str = app.roles_fields.get(2).cloned().unwrap_or_default();
            let quota: u64 = match quota_str.parse() {
                Ok(q) if q > 0 => q,
                _ => {
                    app.set_toast(Toast::error("Enter valid quota"));
                    return;
                }
            };
            app.confirm = Some(ConfirmDialog {
                title: "Add Minter".into(),
                body: format!("Add minter {} with quota {}", &address, quota),
                on_confirm: ConfirmAction::AddMinter { address, quota },
                selected: true,
            });
        }
    }

    app.input_mode = InputMode::Normal;
}
