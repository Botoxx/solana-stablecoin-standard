use ratatui::style::{Color, Modifier, Style};

// Dark financial aesthetic — matches frontend CSS variables
pub const BG: Color = Color::Rgb(2, 6, 23); // slate-950
pub const BG_PANEL: Color = Color::Rgb(15, 23, 42); // slate-900
pub const FG: Color = Color::Rgb(241, 245, 249); // slate-100
pub const FG_DIM: Color = Color::Rgb(100, 116, 139); // slate-500
pub const ACCENT: Color = Color::Rgb(16, 185, 129); // emerald-500
pub const DANGER: Color = Color::Rgb(244, 63, 94); // rose-500
pub const WARNING: Color = Color::Rgb(245, 158, 11); // amber-500
pub const INFO: Color = Color::Rgb(56, 189, 248); // sky-400
pub const BORDER: Color = Color::Rgb(51, 65, 85); // slate-700

pub fn base() -> Style {
    Style::default().fg(FG).bg(BG)
}

pub fn panel() -> Style {
    Style::default().fg(FG).bg(BG_PANEL)
}

pub fn dim() -> Style {
    Style::default().fg(FG_DIM)
}

pub fn accent() -> Style {
    Style::default().fg(ACCENT)
}

pub fn danger() -> Style {
    Style::default().fg(DANGER)
}

pub fn warning() -> Style {
    Style::default().fg(WARNING)
}

pub fn info() -> Style {
    Style::default().fg(INFO)
}

pub fn bold() -> Style {
    Style::default().fg(FG).add_modifier(Modifier::BOLD)
}

pub fn selected() -> Style {
    Style::default().fg(BG).bg(ACCENT)
}

pub fn border() -> Style {
    Style::default().fg(BORDER)
}

pub fn tab_active() -> Style {
    Style::default().fg(ACCENT).add_modifier(Modifier::BOLD)
}

pub fn tab_inactive() -> Style {
    Style::default().fg(FG_DIM)
}

/// Truncate a pubkey to `{first}..{last}` format.
pub fn truncate_pubkey(pk: &str, n: usize) -> String {
    if pk.len() <= n * 2 + 2 {
        pk.to_string()
    } else {
        format!("{}..{}", &pk[..n], &pk[pk.len() - n..])
    }
}

/// Format a lamports/token amount with decimals.
/// Thousand separators, trailing zero trimming (min 2 decimal places).
/// Guards against overflow: 10u64.pow(20+) overflows, so clamp to 19.
pub fn format_amount(raw: u64, decimals: u8) -> String {
    if decimals > 19 {
        return format!("{raw} (raw, decimals={decimals})");
    }
    let divisor = 10u64.pow(decimals as u32);
    let whole = raw / divisor;
    let frac = raw % divisor;

    let whole_str = thousands_sep(whole);

    if decimals == 0 {
        whole_str
    } else {
        let frac_str = format!("{:0>width$}", frac, width = decimals as usize);
        // Trim trailing zeros but keep at least 2 decimal places
        let min_len = 2.min(decimals as usize);
        let trimmed = frac_str.trim_end_matches('0');
        let keep = trimmed.len().max(min_len);
        format!("{}.{}", whole_str, &frac_str[..keep])
    }
}

fn thousands_sep(n: u64) -> String {
    let s = n.to_string();
    let mut result = String::with_capacity(s.len() + s.len() / 3);
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            result.push(',');
        }
        result.push(c);
    }
    result
}
