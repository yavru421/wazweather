CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    latency_ms REAL NOT NULL,
    status_code INTEGER NOT NULL,
    client_ip TEXT
);
