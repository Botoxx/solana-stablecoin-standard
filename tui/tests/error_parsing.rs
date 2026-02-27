use sss_tui::error::{error_message, parse_tx_error};

#[test]
fn test_error_messages_all_known_codes() {
    let expected = [
        (6000, "Unauthorized"),
        (6001, "paused"),
        (6002, "not paused"),
        (6003, "Sender is blacklisted"),
        (6004, "Recipient is blacklisted"),
        (6005, "frozen before seizure"),
        (6006, "Invalid treasury"),
        (6007, "quota exceeded"),
        (6008, "reason is required"),
        (6009, "Compliance features not enabled"),
        (6010, "already blacklisted"),
        (6011, "not blacklisted"),
        (6012, "Invalid role type"),
        (6013, "Authority mismatch"),
        (6014, "Pending authority mismatch"),
        (6015, "No pending authority"),
        (6016, "Minter already configured"),
        (6017, "Minter not found"),
        (6018, "Amount must be greater than zero"),
        (6019, "String length exceeds"),
        (6020, "Arithmetic overflow"),
        (6021, "Mint does not match"),
        (6022, "reason too long"),
        (6023, "Role already assigned"),
    ];

    for (code, substring) in expected {
        let msg = error_message(code);
        assert!(
            msg.contains(substring),
            "Code {code}: expected message containing '{substring}', got '{msg}'"
        );
    }
}

#[test]
fn test_error_message_unknown() {
    assert_eq!(error_message(9999), "Unknown program error");
    assert_eq!(error_message(0), "Unknown program error");
}

#[test]
fn test_parse_tx_error_found() {
    let logs = vec![
        "Program log: Instruction: Mint".to_string(),
        "Program log: AnchorError caused by account: authority. Error Code: Unauthorized. Error Number: 6000. Error Message: Unauthorized.".to_string(),
        "Program SSS_TOKEN_PROGRAM_ID consumed 5000 of 200000 compute units".to_string(),
        "Program SSS_TOKEN_PROGRAM_ID failed: custom program error: 0x1770".to_string(),
    ];

    let result = parse_tx_error(&logs);
    assert!(result.is_some());
    let (code, msg) = result.unwrap();
    assert_eq!(code, 6000);
    assert!(msg.contains("Unauthorized"));
}

#[test]
fn test_parse_tx_error_hex_parsing() {
    // 0x1771 = 6001 (Paused)
    let logs = vec!["custom program error: 0x1771".to_string()];
    let result = parse_tx_error(&logs);
    assert_eq!(result, Some((6001, "System is paused")));
}

#[test]
fn test_parse_tx_error_not_found() {
    let logs = vec![
        "Program log: Instruction: Mint".to_string(),
        "Program SSS consumed 5000 of 200000 compute units".to_string(),
    ];

    assert!(parse_tx_error(&logs).is_none());
}

#[test]
fn test_parse_tx_error_empty_logs() {
    assert!(parse_tx_error(&[]).is_none());
}
