ScraperLBC
============

Simple scraper for leboncoin's "finder/search" API using curl_cffi.requests.

Files:
- `ScraperLBC.py` - main scraper class
- `Test.py` - example/test harness that reads `config.ini` and runs the scraper
- `config.ini.example` - example config for API params and headers/cookies/client/mongodb
- `requirements.txt` - required Python packages
- `run_collector.py` - scheduled runner that scrapes and persists to Supabase

Quick start
-----------

1. Create a venv and install requirements:

```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Copy `config.ini.example` to `config.ini` and edit if needed.

3. Run the test script:

```
python Test.py --max 10
```

Supabase persistence and scheduling
-----------------------------------

- Fill the `[supabase]` section in `config.ini` with your project `url` and `key` plus table names.
- Optional: provide a `dsn` (service role) to auto-create tables on first run using `supabase_schema.sql`, otherwise run the SQL manually in Supabase SQL Editor.
- To run the collector once:

```
python run_collector.py 
```

- Schedule twice per day:
  - Linux (cron):
    ```
    # Run at 01:00 and 13:00 UTC
  0 1,13 * * * /usr/bin/python3 /path/to/run_collector.py --config /path/to/config.ini --max 200 >> /var/log/lbc-collector.log 2>&1
    ```
  - Windows (Task Scheduler): Create a basic task, trigger daily at 01:00 and 13:00, action:
    - Program/script: `C:\\path\\to\\python.exe`
    - Arguments: `C:\\path\\to\\run_collector.py --config C:\\path\\to\\config.ini --max 200`
    - Start in: `C:\\path\\to\\project`

Uniqueness and retries
-----------------------

- The collector computes a `unique_key` (prefers `list_id`, else `id`, else suffix of `url`) and upserts rows into Supabase with on_conflict on `unique_key`.
- Each run is logged in a `runs` table (start/finish time, counts, success/error).
- On failure, the collector retries the whole run up to `--max-retries` with a sleep `--retry-sleep` between attempts.

Render.com
----------

- Start command (web service):
  ```
  uvicorn web_app:app --host 0.0.0.0 --port $PORT
  ```
- Environment variables:
  - `WEB_CONFIG` (optional): chemin vers config.ini si différent
  - `WEB_CRON` (optionnel): expression crontab pour le scheduler (ex: `0 1,13 * * *`)

Notes
-----
- The class uses `curl_cffi.requests`; if you prefer `requests` replace the import and adjust the `send_request` method.
- The API may require additional authentication or cookies; the default headers include an `api_key` inferred from the attachment but this may be rate-limited or invalid. Adjust headers in the `ScraperLBC` constructor or via `config.ini`.
- All date/time fields are stored as epoch seconds (bigint) in Supabase: `first_publication_date`, `expiration_date`, `index_date`, `first_seen_at`, `updated_at`, and run `started_at`/`finished_at`.
# CarsData
