import time
import datetime
import random
import os
import requests
import sqlite3

DB_PATH = 'wazweather_analytics.db'

# Sample API Endpoints to poll
WEATHER_APIS = [
    "https://api.weather.gov/",
    # Add other endpoints here
]

def poll_weather_data():
    """Poll weather data APIs and handle local caching/telemetry."""
    print(f"[{datetime.datetime.now().isoformat()}] Polling weather data...")
    
    for api_url in WEATHER_APIS:
        start_time = time.time()
        status_code = 500
        try:
            # Simulate a request
            response = requests.get(api_url, timeout=5)
            status_code = response.status_code
            print(f"  -> Successfully polled {api_url} (Status: {status_code})")
        except Exception as e:
            print(f"  -> Failed to poll {api_url}: {e}")
        finally:
            latency_ms = (time.time() - start_time) * 1000
            
            # Log to local analytics DB
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO analytics (timestamp, endpoint, latency_ms, status_code)
                    VALUES (?, ?, ?, ?)
                ''', (datetime.datetime.now().isoformat(), api_url, latency_ms, status_code))
                conn.commit()
                conn.close()
            except Exception as db_e:
                print(f"  -> Database error: {db_e}")

def run_worker():
    print("Starting WazWeather Local Background Worker...")
    try:
        while True:
            poll_weather_data()
            # Wait 60 seconds before polling again
            time.sleep(60)
    except KeyboardInterrupt:
        print("\nWorker stopped.")

if __name__ == '__main__':
    run_worker()
