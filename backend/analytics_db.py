import sqlite3
import time
import datetime
import os

DB_PATH = 'wazweather_analytics.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            latency_ms REAL NOT NULL,
            status_code INTEGER NOT NULL,
            client_ip TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            cpu_usage REAL,
            memory_usage REAL,
            active_connections INTEGER
        )
    ''')
    conn.commit()
    conn.close()

def log_request(endpoint, latency_ms, status_code, client_ip=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    timestamp = datetime.datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO analytics (timestamp, endpoint, latency_ms, status_code, client_ip)
        VALUES (?, ?, ?, ?, ?)
    ''', (timestamp, endpoint, latency_ms, status_code, client_ip))
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print(f"Initialized analytics database at {DB_PATH}")
