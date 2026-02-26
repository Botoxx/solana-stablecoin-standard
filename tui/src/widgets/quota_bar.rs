use ratatui::{layout::Rect, widgets::Gauge, Frame};

use crate::theme;

pub fn render(f: &mut Frame, used: u64, total: u64, area: Rect) {
    let pct = if total == 0 {
        0.0
    } else {
        let remaining = total.saturating_sub(used);
        // Show how much quota remains
        (remaining as f64 / total as f64).clamp(0.0, 1.0)
    };

    let label = format!(
        "{}/{} ({:.0}% remaining)",
        total.saturating_sub(used),
        total,
        pct * 100.0
    );

    let gauge = Gauge::default()
        .gauge_style(theme::accent())
        .ratio(pct)
        .label(label);

    f.render_widget(gauge, area);
}
