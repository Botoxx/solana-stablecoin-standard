use crossterm::event::KeyCode;
use ratatui::{
    layout::{Constraint, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table},
    Frame,
};

use crate::app::App;
use crate::events::EventColor;
use crate::theme;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Event Stream ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    if app.events.is_empty() {
        let lines = vec![
            Line::from(""),
            Line::from(Span::styled("  Waiting for events...", theme::dim())),
            Line::from(Span::styled(
                "  Events will appear here in real-time via WebSocket",
                theme::dim(),
            )),
        ];

        if !app.ws_connected {
            let mut lines = lines;
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "  WebSocket disconnected",
                theme::warning(),
            )));
            f.render_widget(Paragraph::new(lines).block(block), area);
        } else {
            f.render_widget(Paragraph::new(lines).block(block), area);
        }
        return;
    }

    let header = Row::new(vec![
        Cell::from(Span::styled("Time", theme::dim())),
        Cell::from(Span::styled("Event", theme::dim())),
        Cell::from(Span::styled("Authority", theme::dim())),
        Cell::from(Span::styled("Details", theme::dim())),
        Cell::from(Span::styled("Tx", theme::dim())),
    ]);

    let inner_height = block.inner(area).height as usize;

    // Apply filter if set
    let filtered: Vec<_> = app
        .events
        .iter()
        .filter(|e| {
            app.events_filter
                .as_ref()
                .map(|f| e.name.to_lowercase().contains(&f.to_lowercase()))
                .unwrap_or(true)
        })
        .collect();

    let total = filtered.len();
    let visible_start = if app.events_auto_scroll {
        total.saturating_sub(inner_height.saturating_sub(1))
    } else {
        app.events_scroll
            .min(total.saturating_sub(inner_height.saturating_sub(1)))
    };

    let rows: Vec<Row> = filtered
        .iter()
        .skip(visible_start)
        .take(inner_height.saturating_sub(1))
        .map(|evt| {
            let color = match evt.color_category() {
                EventColor::Green => theme::ACCENT,
                EventColor::Red => theme::DANGER,
                EventColor::Yellow => theme::WARNING,
                EventColor::Blue => theme::INFO,
                EventColor::Cyan => theme::INFO,
                EventColor::Default => theme::FG_DIM,
            };
            let evt_style = ratatui::style::Style::default().fg(color);

            let ts = chrono::DateTime::from_timestamp(evt.timestamp, 0)
                .map(|dt| dt.format("%H:%M:%S").to_string())
                .unwrap_or_else(|| "---".into());

            let details: String = evt
                .fields
                .iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join(", ");

            let tx = evt
                .tx_sig
                .as_ref()
                .map(|s| {
                    if s.len() > 8 {
                        format!("{}..{}", &s[..4], &s[s.len() - 4..])
                    } else {
                        s.clone()
                    }
                })
                .unwrap_or_default();

            Row::new(vec![
                Cell::from(Span::styled(ts, theme::dim())),
                Cell::from(Span::styled(&evt.name, evt_style)),
                Cell::from(Span::styled(&evt.authority, theme::dim())),
                Cell::from(Span::styled(details, theme::base())),
                Cell::from(Span::styled(tx, theme::dim())),
            ])
        })
        .collect();

    let title = if let Some(ref filter) = app.events_filter {
        format!(" Event Stream [filter: {filter}] ({total} events) ")
    } else {
        format!(" Event Stream ({total} events) ")
    };

    let block = Block::default()
        .title(Span::styled(title, theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    let table = Table::new(
        rows,
        [
            Constraint::Length(10),
            Constraint::Length(18),
            Constraint::Length(12),
            Constraint::Min(30),
            Constraint::Length(12),
        ],
    )
    .header(header)
    .block(block);

    f.render_widget(table, area);
}

pub fn handle_input(app: &mut App, key: crossterm::event::KeyEvent) {
    match key.code {
        KeyCode::Char('j') | KeyCode::Down => {
            app.events_auto_scroll = false;
            app.events_scroll = app.events_scroll.saturating_add(1);
        }
        KeyCode::Char('k') | KeyCode::Up => {
            app.events_auto_scroll = false;
            app.events_scroll = app.events_scroll.saturating_sub(1);
        }
        KeyCode::Char('g') => {
            app.events_auto_scroll = false;
            app.events_scroll = 0;
        }
        KeyCode::Char('G') => {
            app.events_auto_scroll = true;
        }
        KeyCode::Char('f') => {
            // Toggle filter
            if app.events_filter.is_some() {
                app.events_filter = None;
            } else {
                // Cycle through common filters
                app.events_filter = Some("Mint".into());
            }
        }
        _ => {}
    }
}
