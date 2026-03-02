use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Paragraph},
    Frame,
};

use crate::theme;

pub fn render(f: &mut Frame) {
    let area = centered_rect(60, 70, f.area());
    f.render_widget(Clear, area);

    let block = Block::default()
        .title(Span::styled(" Keybindings ", theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::accent());

    let bindings = vec![
        ("1-6", "Switch screens"),
        ("q", "Quit"),
        ("?", "Toggle help"),
        ("r", "Refresh data"),
        ("Ctrl+C", "Force quit"),
        ("", ""),
        ("--- Operations ---", ""),
        ("Tab", "Next field / sub-tab"),
        ("Shift+Tab", "Previous field / sub-tab"),
        ("Enter", "Submit / Confirm"),
        ("Esc", "Cancel / Normal mode"),
        ("e/i", "Enter edit mode"),
        ("", ""),
        ("--- Roles ---", ""),
        ("a", "Assign role / Add minter"),
        ("d", "Revoke role / Remove minter"),
        ("j/k", "Navigate table rows"),
        ("", ""),
        ("--- Events ---", ""),
        ("j/k", "Scroll up/down"),
        ("g/G", "Jump to top/bottom"),
        ("f", "Toggle filter"),
        ("", ""),
        ("--- Compliance ---", ""),
        ("a", "Add to blacklist"),
        ("d", "Remove from blacklist"),
        ("s", "Seize tokens"),
    ];

    let lines: Vec<Line> = bindings
        .iter()
        .map(|(key, desc)| {
            if key.is_empty() {
                Line::from("")
            } else if desc.is_empty() {
                Line::from(Span::styled(*key, theme::accent()))
            } else {
                Line::from(vec![
                    Span::styled(format!("{:>12}", key), theme::accent()),
                    Span::raw("  "),
                    Span::styled(*desc, theme::base()),
                ])
            }
        })
        .collect();

    let para = Paragraph::new(lines)
        .block(block)
        .alignment(Alignment::Left);
    f.render_widget(para, area);
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let v = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(v[1])[1]
}
