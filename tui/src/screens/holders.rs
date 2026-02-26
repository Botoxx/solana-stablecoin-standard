use crossterm::event::KeyCode;
use ratatui::{
    layout::{Constraint, Rect},
    text::Span,
    widgets::{Block, Borders, Cell, Paragraph, Row, Table},
    Frame,
};

use crate::app::App;
use crate::theme;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(
            format!(" Holders ({}) ", app.holders.len()),
            theme::bold(),
        ))
        .borders(Borders::ALL)
        .border_style(theme::border());

    if app.holders.is_empty() {
        f.render_widget(
            Paragraph::new(Span::styled("  No token holders found", theme::dim())).block(block),
            area,
        );
        return;
    }

    let decimals = app.config.as_ref().map(|c| c.decimals).unwrap_or(6);
    let total_supply = app.supply.unwrap_or(1);

    let header = Row::new(vec![
        Cell::from(Span::styled("#", theme::dim())),
        Cell::from(Span::styled("Owner", theme::dim())),
        Cell::from(Span::styled("Balance", theme::dim())),
        Cell::from(Span::styled("% Supply", theme::dim())),
        Cell::from(Span::styled("Status", theme::dim())),
    ]);

    // Sort by balance descending
    let mut sorted = app.holders.clone();
    sorted.sort_by(|a, b| b.balance.cmp(&a.balance));

    let rows: Vec<Row> = sorted
        .iter()
        .enumerate()
        .map(|(i, holder)| {
            let style = if i == app.holders_selected {
                theme::selected()
            } else {
                theme::base()
            };

            let pct = if total_supply > 0 {
                (holder.balance as f64 / total_supply as f64) * 100.0
            } else {
                0.0
            };

            let status = if holder.frozen {
                Span::styled("FROZEN", theme::danger())
            } else {
                Span::styled("active", theme::accent())
            };

            Row::new(vec![
                Cell::from(Span::styled(format!("{}", i + 1), theme::dim())),
                Cell::from(Span::styled(
                    theme::truncate_pubkey(&holder.owner.to_string(), 6),
                    style,
                )),
                Cell::from(Span::styled(
                    theme::format_amount(holder.balance, decimals),
                    style,
                )),
                Cell::from(Span::styled(format!("{:.2}%", pct), theme::dim())),
                Cell::from(status),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(4),
            Constraint::Length(18),
            Constraint::Length(18),
            Constraint::Length(10),
            Constraint::Min(8),
        ],
    )
    .header(header)
    .block(block);

    f.render_widget(table, area);
}

pub fn handle_input(app: &mut App, key: crossterm::event::KeyEvent) {
    match key.code {
        KeyCode::Char('j') | KeyCode::Down => {
            if !app.holders.is_empty() {
                app.holders_selected = (app.holders_selected + 1).min(app.holders.len() - 1);
            }
        }
        KeyCode::Char('k') | KeyCode::Up => {
            app.holders_selected = app.holders_selected.saturating_sub(1);
        }
        _ => {}
    }
}
