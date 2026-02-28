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
    let max_width = area.width.saturating_sub(4).max(20) as usize;
    // Inner width = max_width - 2 (borders)
    let inner_w = max_width.saturating_sub(2);

    // Word-wrap the message
    let lines = wrap_text(&toast.message, inner_w);
    let line_count = lines.len().max(1) as u16;
    let longest = lines.iter().map(|l| l.len()).max().unwrap_or(0);

    let width = (longest as u16 + 4).min(area.width.saturating_sub(2));
    let height = (line_count + 2).min(area.height.saturating_sub(2)); // +2 for borders
    let x = area.width.saturating_sub(width + 1);
    let toast_area = Rect::new(x, 1, width, height);

    let style = if toast.is_error {
        theme::danger()
    } else {
        theme::accent()
    };

    f.render_widget(Clear, toast_area);

    let block = Block::default().borders(Borders::ALL).border_style(style);

    let text: Vec<ratatui::text::Line> = lines
        .into_iter()
        .map(|l| ratatui::text::Line::from(Span::styled(l, style)))
        .collect();

    let msg = Paragraph::new(text).block(block);
    f.render_widget(msg, toast_area);
}

fn wrap_text(s: &str, max_width: usize) -> Vec<String> {
    if max_width == 0 {
        return vec![s.to_string()];
    }
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in s.split_whitespace() {
        if current.is_empty() {
            current = word.to_string();
        } else if current.len() + 1 + word.len() <= max_width {
            current.push(' ');
            current.push_str(word);
        } else {
            lines.push(current);
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}
