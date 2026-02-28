use ratatui::{
    layout::Rect,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
    Frame,
};

use crate::app::App;
use crate::theme;

pub fn render(f: &mut Frame, app: &App, area: Rect) {
    let cluster = if let Some(ref cfg) = app.config {
        if cfg.enable_transfer_hook {
            "SSS-2"
        } else {
            "SSS-1"
        }
    } else {
        "---"
    };

    let ws_dot = if app.ws_connected {
        Span::styled(" ● ", theme::accent())
    } else {
        Span::styled(" ○ ", theme::dim())
    };

    let refresh_age = match app.last_refresh {
        Some(t) => format!("{}s ago", t.elapsed().as_secs()),
        None => "never".into(),
    };

    let tx_indicator = if app.tx_pending {
        Span::styled(" ⧗ sending ", theme::warning())
    } else {
        Span::raw("")
    };

    let config_pda = app.config.as_ref().map(|_| "loaded").unwrap_or("none");

    let signer = if app.signer_display.is_empty() {
        "none".to_string()
    } else {
        app.signer_display.clone()
    };

    let status = Line::from(vec![
        Span::styled(" ", theme::dim()),
        Span::styled(cluster, theme::accent()),
        Span::styled(" │ ", theme::dim()),
        Span::styled(format!("Signer: {signer}"), theme::base()),
        Span::styled(" │ ", theme::dim()),
        Span::styled(format!("Config: {config_pda}"), theme::dim()),
        Span::styled(" │ ", theme::dim()),
        Span::styled(format!("Refresh: {refresh_age}"), theme::dim()),
        Span::styled(" │ ", theme::dim()),
        Span::raw("WS:"),
        ws_dot,
        tx_indicator,
        Span::styled(" │ q:quit ?:help r:refresh ", theme::dim()),
    ]);

    let bar = Paragraph::new(status).block(
        Block::default()
            .borders(Borders::TOP)
            .border_style(theme::border()),
    );

    f.render_widget(bar, area);
}
