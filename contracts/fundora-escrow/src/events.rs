//! Fundora — NEP-297 Standard Event Log Emitter
//! Format: `EVENT_JSON:{"standard":"fundora","version":"1.0.0","event":"...","data":[...]}`

use near_sdk::env;
use serde::Serialize;
use serde_json::json;

pub fn emit_nep297_event<T: Serialize>(event_name: &str, data: &T) {
    let payload = json!({
        "standard": "fundora",
        "version": "1.0.0",
        "event": event_name,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{}", payload));
}

