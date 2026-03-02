use crossterm::event::KeyCode;
use ratatui::{
    layout::Rect,
    style::Style,
    text::Span,
    widgets::{Block, Borders, Paragraph},
    Frame,
};

use crate::theme;

/// Render a single-line text input field.
pub fn render(f: &mut Frame, value: &str, label: &str, focused: bool, valid: bool, area: Rect) {
    let border_style = if !valid {
        theme::danger()
    } else if focused {
        theme::accent()
    } else {
        theme::border()
    };

    let block = Block::default()
        .title(Span::styled(
            format!(" {label} "),
            if focused {
                theme::accent()
            } else {
                theme::dim()
            },
        ))
        .borders(Borders::ALL)
        .border_style(border_style);

    let display = if value.is_empty() && !focused {
        Paragraph::new(Span::styled("(empty)", theme::dim())).block(block)
    } else {
        let text = if focused {
            format!("{value}▏")
        } else {
            value.to_string()
        };
        Paragraph::new(Span::styled(text, Style::default().fg(theme::FG))).block(block)
    };

    f.render_widget(display, area);
}

/// Handle a key event for a text input field. Returns the new value.
pub fn handle_key(value: &mut String, code: KeyCode) {
    match code {
        KeyCode::Char(c) => value.push(c),
        KeyCode::Backspace => {
            value.pop();
        }
        _ => {}
    }
}

/// Validate as a Solana pubkey (base58, 32-44 chars).
pub fn is_valid_pubkey(s: &str) -> bool {
    if s.is_empty() {
        return true; // Allow empty during editing
    }
    s.parse::<solana_sdk::pubkey::Pubkey>().is_ok()
}

/// Validate as a positive integer amount.
pub fn is_valid_amount(s: &str) -> bool {
    if s.is_empty() {
        return true;
    }
    s.parse::<u64>().map(|n| n > 0).unwrap_or(false)
}
