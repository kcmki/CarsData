ScraperCars
============

Simple scraper for leboncoin's "finder/search" API using curl_cffi.requests.

Files:
- `ScraperCars.py` - main scraper class
- `Test.py` - example/test harness that reads `config.ini` and runs the scraper
- `config.ini.example` - example config for API params and headers/cookies/client/mongodb
- `requirements.txt` - required Python packages
- `run_collector.py` - scheduled runner that scrapes and persists to MongoDB

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

MongoDB persistence and scheduling
----------------------------------

- Fill the `[mongodb]` section in `config.ini` with your connection info.
- To run the collector once:

```
python run_collector.py --max 100
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
----------------------

- The collector computes a `unique_key` (prefers `list_id`, else `id`, else suffix of `url`) and upserts documents with a unique index on `unique_key`.
- Each run is logged in a `runs` collection (start/finish time, counts, success/error).
- On failure, the collector retries the whole run up to `--max-retries` with a sleep `--retry-sleep` between attempts.

Notes
-----
- The class uses `curl_cffi.requests`; if you prefer `requests` replace the import and adjust the `send_request` method.
- The API may require additional authentication or cookies; the default headers include an `api_key` inferred from the attachment but this may be rate-limited or invalid. Adjust headers in the `ScraperCars` constructor or via `config.ini`.
# CarsData
