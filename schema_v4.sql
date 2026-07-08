CREATE TABLE IF NOT EXISTS user_preferences (
    user_uuid TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    default_zip TEXT,
    temp_units TEXT,
    theme_preference TEXT,
    updated_at TEXT
);
