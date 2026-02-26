use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::{Block, Borders, Tabs},
    Frame,
};

use crate::app::{App, Screen};
use crate::theme;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    let titles: Vec<Line> = Screen::ALL
        .iter()
        .enumerate()
        .map(|(i, s)| {
            Line::from(Span::styled(
                format!(" {} {} ", i + 1, s.label()),
                if *s == app.screen {
                    theme::tab_active()
                } else {
                    theme::tab_inactive()
                },
            ))
        })
        .collect();

    let tabs = Tabs::new(titles)
        .block(
            Block::default()
                .borders(Borders::BOTTOM)
                .border_style(theme::border())
                .title(Span::styled(" SSS Admin TUI ", theme::bold())),
        )
        .select(app.screen as usize)
        .highlight_style(theme::tab_active());

    f.render_widget(tabs, area);
}
