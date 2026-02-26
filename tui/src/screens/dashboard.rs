use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table},
    Frame,
};

use crate::app::App;
use crate::theme;
use crate::widgets::quota_bar;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    if app.config.is_none() {
        let msg = Paragraph::new(Span::styled(
            " No config loaded. Pass --config-pda or set in ~/.config/sss-tui/config.toml",
            theme::warning(),
        ))
        .block(
            Block::default()
                .title(" Dashboard ")
                .borders(Borders::ALL)
                .border_style(theme::border()),
        );
        f.render_widget(msg, area);
        return;
    }

    let config = app.config.as_ref().unwrap();

    // Top row: Status | Supply | Extensions
    // Bottom: Minter quotas | Recent events
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(10), Constraint::Min(8)])
        .split(area);

    let top_cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(35),
            Constraint::Percentage(30),
            Constraint::Percentage(35),
        ])
        .split(rows[0]);

    // -- Status panel --
    let name = app.token_name.as_deref().unwrap_or("(unknown)");
    let symbol = app.token_symbol.as_deref().unwrap_or("???");
    let paused_str = if config.paused { "PAUSED" } else { "ACTIVE" };
    let paused_style = if config.paused {
        theme::danger()
    } else {
        theme::accent()
    };
    let preset = if config.enable_transfer_hook {
        "SSS-2 (Compliant)"
    } else {
        "SSS-1 (Minimal)"
    };

    let status_lines = vec![
        Line::from(vec![
            Span::styled("  Token: ", theme::dim()),
            Span::styled(format!("{name} ({symbol})"), theme::bold()),
        ]),
        Line::from(vec![
            Span::styled("  State: ", theme::dim()),
            Span::styled(paused_str, paused_style),
        ]),
        Line::from(vec![
            Span::styled(" Preset: ", theme::dim()),
            Span::styled(preset, theme::info()),
        ]),
        Line::from(vec![
            Span::styled("   Auth: ", theme::dim()),
            Span::styled(
                theme::truncate_pubkey(&config.authority.to_string(), 6),
                theme::base(),
            ),
        ]),
        Line::from(vec![
            Span::styled("   Mint: ", theme::dim()),
            Span::styled(
                theme::truncate_pubkey(&config.mint.to_string(), 6),
                theme::base(),
            ),
        ]),
        Line::from(vec![
            Span::styled("Treasury: ", theme::dim()),
            Span::styled(
                theme::truncate_pubkey(&config.treasury.to_string(), 6),
                theme::base(),
            ),
        ]),
    ];

    let status_block = Block::default()
        .title(Span::styled(" Status ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());
    f.render_widget(
        Paragraph::new(status_lines).block(status_block),
        top_cols[0],
    );

    // -- Supply panel --
    let supply = app.supply.unwrap_or(config.current_supply());
    let supply_str = theme::format_amount(supply, config.decimals);
    let minted_str = theme::format_amount(config.total_minted, config.decimals);
    let burned_str = theme::format_amount(config.total_burned, config.decimals);

    let supply_lines = vec![
        Line::from(""),
        Line::from(vec![
            Span::styled("  Supply: ", theme::dim()),
            Span::styled(supply_str, theme::bold()),
        ]),
        Line::from(vec![
            Span::styled("  Minted: ", theme::dim()),
            Span::styled(minted_str, theme::accent()),
        ]),
        Line::from(vec![
            Span::styled("  Burned: ", theme::dim()),
            Span::styled(burned_str, theme::danger()),
        ]),
        Line::from(vec![
            Span::styled("Decimals: ", theme::dim()),
            Span::styled(config.decimals.to_string(), theme::base()),
        ]),
    ];

    let supply_block = Block::default()
        .title(Span::styled(" Supply ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());
    f.render_widget(
        Paragraph::new(supply_lines).block(supply_block),
        top_cols[1],
    );

    // -- Extensions panel --
    let ext_lines = vec![
        Line::from(""),
        Line::from(vec![
            Span::styled(" Permanent Delegate: ", theme::dim()),
            bool_span(config.enable_permanent_delegate),
        ]),
        Line::from(vec![
            Span::styled("     Transfer Hook: ", theme::dim()),
            bool_span(config.enable_transfer_hook),
        ]),
        Line::from(vec![
            Span::styled("   Default Frozen: ", theme::dim()),
            bool_span(config.default_account_frozen),
        ]),
        Line::from(vec![
            Span::styled("     Holders: ", theme::dim()),
            Span::styled(app.holders.len().to_string(), theme::base()),
        ]),
        Line::from(vec![
            Span::styled("      Roles: ", theme::dim()),
            Span::styled(app.roles.len().to_string(), theme::base()),
        ]),
    ];

    let ext_block = Block::default()
        .title(Span::styled(" Extensions ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());
    f.render_widget(Paragraph::new(ext_lines).block(ext_block), top_cols[2]);

    // -- Bottom row: Minter quotas | Recent events --
    let bottom_cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(rows[1]);

    // Minter quotas
    render_minter_quotas(f, app, bottom_cols[0]);

    // Recent events
    render_recent_events(f, app, bottom_cols[1]);
}

fn render_minter_quotas(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Minter Quotas ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    if app.minters.is_empty() {
        f.render_widget(
            Paragraph::new(Span::styled("  No minters configured", theme::dim())).block(block),
            area,
        );
        return;
    }

    let inner = block.inner(area);
    f.render_widget(block, area);

    let constraints: Vec<Constraint> = app
        .minters
        .iter()
        .take(inner.height as usize / 2)
        .flat_map(|_| vec![Constraint::Length(1), Constraint::Length(1)])
        .collect();

    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints(constraints)
        .split(inner);

    for (i, minter) in app.minters.iter().enumerate() {
        let row_idx = i * 2;
        if row_idx + 1 >= rows.len() {
            break;
        }

        let label = Line::from(vec![
            Span::styled(" ", theme::dim()),
            Span::styled(
                theme::truncate_pubkey(&minter.minter.to_string(), 4),
                theme::base(),
            ),
        ]);
        f.render_widget(Paragraph::new(label), rows[row_idx]);

        let used = minter.quota_total.saturating_sub(minter.quota_remaining);
        quota_bar::render(f, used, minter.quota_total, rows[row_idx + 1]);
    }
}

fn render_recent_events(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title(Span::styled(" Recent Events ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::border());

    if app.events.is_empty() {
        f.render_widget(
            Paragraph::new(Span::styled("  No events yet", theme::dim())).block(block),
            area,
        );
        return;
    }

    let header = Row::new(vec![
        Cell::from(Span::styled("Event", theme::dim())),
        Cell::from(Span::styled("Authority", theme::dim())),
        Cell::from(Span::styled("Details", theme::dim())),
    ]);

    let rows: Vec<Row> = app
        .events
        .iter()
        .rev()
        .take(10)
        .map(|evt| {
            let color = match evt.color_category() {
                crate::events::EventColor::Green => theme::ACCENT,
                crate::events::EventColor::Red => theme::DANGER,
                crate::events::EventColor::Yellow => theme::WARNING,
                crate::events::EventColor::Blue => theme::INFO,
                crate::events::EventColor::Cyan => theme::INFO,
                crate::events::EventColor::Default => theme::FG_DIM,
            };
            let details: String = evt
                .fields
                .iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join(", ");
            Row::new(vec![
                Cell::from(Span::styled(
                    &evt.name,
                    ratatui::style::Style::default().fg(color),
                )),
                Cell::from(Span::styled(&evt.authority, theme::dim())),
                Cell::from(Span::styled(details, theme::dim())),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(16),
            Constraint::Length(12),
            Constraint::Min(20),
        ],
    )
    .header(header)
    .block(block);

    f.render_widget(table, area);
}

fn bool_span(v: bool) -> Span<'static> {
    if v {
        Span::styled("enabled", theme::accent())
    } else {
        Span::styled("disabled", theme::dim())
    }
}
