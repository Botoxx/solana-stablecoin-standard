use ratatui::{
    layout::Rect,
    text::Span,
    widgets::{Block, Borders, Clear, Paragraph},
    Frame,
};

use crate::app::App;
use crate::theme;

pub fn render(f: &mut Frame, app: &App) {
    let Some(ref toast) = app.toast else {
        return;
    };

    let area = f.area();
    // Top-right corner
    let width = (toast.message.len() as u16 + 4).min(area.width.saturating_sub(2));
    let x = area.width.saturating_sub(width + 1);
    let toast_area = Rect::new(x, 1, width, 3);

    let style = if toast.is_error {
        theme::danger()
    } else {
        theme::accent()
    };

    f.render_widget(Clear, toast_area);

    let block = Block::default().borders(Borders::ALL).border_style(style);

    let msg = Paragraph::new(Span::styled(&toast.message, style)).block(block);
    f.render_widget(msg, toast_area);
}
