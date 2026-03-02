use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Paragraph},
    Frame,
};

use crate::app::App;
use crate::theme;

pub fn render(f: &mut Frame, app: &App) {
    let Some(ref dialog) = app.confirm else {
        return;
    };

    let area = centered_rect(50, 30, f.area());

    // Clear background
    f.render_widget(Clear, area);

    let block = Block::default()
        .title(Span::styled(format!(" {} ", dialog.title), theme::bold()))
        .borders(Borders::ALL)
        .border_style(theme::accent());

    let inner = block.inner(area);
    f.render_widget(block, area);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(3), Constraint::Length(3)])
        .split(inner);

    // Body
    let body = Paragraph::new(dialog.body.as_str())
        .style(theme::base())
        .alignment(Alignment::Left);
    f.render_widget(body, chunks[0]);

    // Buttons
    let cancel_style = if !dialog.selected {
        theme::selected()
    } else {
        theme::dim()
    };
    let confirm_style = if dialog.selected {
        theme::selected()
    } else {
        theme::dim()
    };

    let buttons = Line::from(vec![
        Span::styled(" [Cancel] ", cancel_style),
        Span::raw("  "),
        Span::styled(" [Confirm] ", confirm_style),
    ]);

    let btn_para = Paragraph::new(buttons).alignment(Alignment::Center);
    f.render_widget(btn_para, chunks[1]);
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
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
        .split(popup_layout[1])[1]
}
