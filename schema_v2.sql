ALTER TABLE analytics RENAME TO analytics_legacy;

CREATE TABLE analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    endpoint TEXT,
    latency_ms REAL,
    status_code INTEGER,
    
    -- Edge Data (cf object)
    client_ip TEXT,
    cf_city TEXT,
    cf_region TEXT,
    cf_country TEXT,
    cf_postal_code TEXT,
    cf_latitude REAL,
    cf_longitude REAL,
    cf_asn INTEGER,
    cf_as_organization TEXT,
    cf_bot_score INTEGER,
    cf_device_type TEXT,
    
    -- Browser/Hardware Data
    user_agent TEXT,
    connection_type TEXT,
    pwa_installed BOOLEAN,
    
    -- App Events & Vitals
    event_type TEXT,
    web_vitals_ttfb REAL,
    web_vitals_fcp REAL,
    web_vitals_cls REAL
);
