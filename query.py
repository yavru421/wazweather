import sys, duckdb, os

hours = int(sys.argv[1]) if len(sys.argv) > 1 else 24
db_path = os.environ.get('ST_CODEX_DB_PATH', r'C:\Users\John\Documents\Snaptempo_Codex\out\st_codex.duckdb')
excavator_path = os.environ.get('EXCAVATOR_DB_PATH', r'C:\Users\John\Pictures\Screenshots\screenshot_excavator\out\excavator.duckdb')

con = duckdb.connect(db_path, read_only=True)
con.execute(f"ATTACH '{excavator_path}' AS excavator")

query = f'''
WITH recent_visuals AS (
    SELECT 
        s.time.fs_timestamp AS event_time,
        'Visual State (' || COALESCE(s.analysis.image_class, 'unknown') || ')' AS activity_type,
        s.identity.source_file || ' | OCR: ' || SUBSTR(COALESCE(s.content.normalized_ocr, ''), 1, 60) AS target,
        COALESCE(s.context.primary_category, 'general') AS functional_domain
    FROM excavator.ssr s
    WHERE CAST(s.time.fs_timestamp AS TIMESTAMP) >= CURRENT_TIMESTAMP - INTERVAL '{hours} HOURS'
),
recent_codex AS (
    SELECT 
        f.last_modified AS event_time,
        'Codex File' AS activity_type,
        f.filename || ' | Section: ' || COALESCE(s.header, 'none') AS target,
        'Documentation' AS functional_domain
    FROM codex_files f
    JOIN codex_sections s USING (filename)
    WHERE CAST(f.last_modified AS TIMESTAMP) >= CURRENT_TIMESTAMP - INTERVAL '{hours} HOURS'
)
SELECT event_time, activity_type, target, functional_domain
FROM (
    SELECT * FROM recent_visuals
    UNION ALL
    SELECT * FROM recent_codex
)
ORDER BY event_time DESC
LIMIT 50;
'''
try:
    res = con.execute(query).fetchall()
    for r in res:
        print(f'{r[0]} | {r[1]} | {r[2]} | {r[3]}')
except Exception as e:
    print(e)
finally:
    con.close()
