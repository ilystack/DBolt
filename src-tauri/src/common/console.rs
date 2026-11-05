//! Shared DBolt console API plumbing: base URL resolution and a process
//! wide HTTP client.

use std::sync::OnceLock;
use std::time::Duration;

const CONSOLE_PROD_URL: &str = "http://127.0.0.1:0";
const CONSOLE_DEV_URL: &str = "http://127.0.0.1:0";

pub fn api_base_url() -> &'static str {
    if cfg!(debug_assertions) {
        static DEV_BASE: OnceLock<Box<str>> = OnceLock::new();
        DEV_BASE
            .get_or_init(|| {
                std::env::var("DBOLT_CONSOLE_API_URL")
                    .ok()
                    .filter(|raw| !raw.trim().is_empty())
                    .map(Into::into)
                    .unwrap_or_else(|| CONSOLE_DEV_URL.into())
            })
            .as_ref()
    } else {
        CONSOLE_PROD_URL
    }
}

pub fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        let builder = reqwest::Client::builder().timeout(Duration::from_secs(10));
        // A pooled socket outlives its tokio test runtime; never keep idle sockets.
        #[cfg(test)]
        let builder = builder.pool_max_idle_per_host(0);
        builder
            .build()
            .expect("reqwest client with static configuration")
    })
}
