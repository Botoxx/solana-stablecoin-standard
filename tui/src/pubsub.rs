use base64::Engine;
use tokio::sync::mpsc;

use crate::event::AppEvent;
use crate::events;
use crate::pda;

/// Spawn a WebSocket log listener that parses SSS events.
pub fn spawn_listener(ws_url: &str, tx: mpsc::UnboundedSender<AppEvent>) {
    let ws_url = ws_url.to_string();
    tokio::spawn(async move {
        let event_map = events::build_event_map();
        let mut retries = 0u32;

        loop {
            match connect_and_listen(&ws_url, &tx, &event_map).await {
                Ok(()) => {
                    // Clean disconnect (stream ended)
                    let _ = tx.send(AppEvent::WsDisconnected(
                        "WebSocket stream ended".into(),
                    ));
                    break;
                }
                Err(e) => {
                    retries += 1;
                    let _ = tx.send(AppEvent::WsDisconnected(format!(
                        "WebSocket disconnected (attempt {retries}/10): {e}"
                    )));
                    if retries > 10 {
                        let _ = tx.send(AppEvent::WsError(
                            "WebSocket permanently disconnected after 10 retries. Press 'r' to refresh data manually.".into()
                        ));
                        break;
                    }
                    let delay = std::cmp::min(5 * retries, 30);
                    tokio::time::sleep(std::time::Duration::from_secs(delay as u64)).await;
                }
            }
        }
    });
}

async fn connect_and_listen(
    ws_url: &str,
    tx: &mpsc::UnboundedSender<AppEvent>,
    event_map: &std::collections::HashMap<[u8; 8], fn(&[u8]) -> Option<events::EventData>>,
) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use solana_client::rpc_config::RpcTransactionLogsConfig;
    use solana_client::rpc_config::RpcTransactionLogsFilter;
    use solana_pubsub_client::nonblocking::pubsub_client::PubsubClient;

    let client = PubsubClient::new(ws_url).await?;

    let program_id = pda::SSS_TOKEN_PROGRAM_ID.to_string();
    let (mut stream, _unsub) = client
        .logs_subscribe(
            RpcTransactionLogsFilter::Mentions(vec![program_id]),
            RpcTransactionLogsConfig {
                commitment: Some(solana_sdk::commitment_config::CommitmentConfig::confirmed()),
            },
        )
        .await?;

    // Connected successfully — notify UI and reset retry logic on caller side
    // (retries are reset by the caller detecting a successful connection via WsEvent arrival)

    use futures_util::StreamExt;
    while let Some(log_result) = stream.next().await {
        let sig = log_result.value.signature.clone();
        for line in &log_result.value.logs {
            if let Some(b64) = line.strip_prefix("Program data: ") {
                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.trim()) {
                    match events::parse_event(&bytes, event_map) {
                        Some(mut event_data) => {
                            event_data.tx_sig = Some(sig.clone());
                            let _ = tx.send(AppEvent::WsEvent(event_data));
                        }
                        None if bytes.len() >= 8 => {
                            // Unknown discriminator — surface as unknown event
                            let disc_hex: String = bytes[..8]
                                .iter()
                                .map(|b| format!("{b:02x}"))
                                .collect();
                            let unknown = events::EventData {
                                name: format!("Unknown({})", &disc_hex[..8.min(disc_hex.len())]),
                                authority: "---".into(),
                                timestamp: 0,
                                fields: vec![("raw_size".into(), bytes.len().to_string())],
                                tx_sig: Some(sig.clone()),
                            };
                            let _ = tx.send(AppEvent::WsEvent(unknown));
                        }
                        _ => {} // Too short to be an event
                    }
                }
            }
        }
    }

    Ok(())
}
