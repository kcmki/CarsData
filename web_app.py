"""
FastAPI web app providing:
- Dashboard: last run info, recent runs, next scheduled run, button to run now
- API endpoints to fetch runs and trigger a run
- APScheduler to run collector twice per day

Environment/config:
- Reads config.ini (path via WEB_CONFIG or default ./config.ini)
- Uses MongoDB config in [mongodb] section to read recent runs for the dashboard
"""
import os
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from pymongo import MongoClient

from run_collector import run_collect, load_config, get_mongo_client

APP_TITLE = "LBC Collector"
CONFIG_PATH = os.environ.get("WEB_CONFIG", "config.ini")

app = FastAPI(title=APP_TITLE)
templates = Jinja2Templates(directory="templates")


# Scheduling
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()
_RUN_LOCK = asyncio.Lock()


def get_db_collections(cfg) -> Dict[str, Any]:
    mongo_cfg = cfg.get("mongodb", {})
    client = get_mongo_client(mongo_cfg)
    db_name = mongo_cfg.get("database", "leboncoin")
    col_name = mongo_cfg.get("collection", "ads")
    runs_collection_name = mongo_cfg.get("runs_collection", "runs")
    db = client[db_name]
    return {"ads": db[col_name], "runs": db[runs_collection_name]}


async def scheduled_run():
    async with _RUN_LOCK:
        # run with defaults from config
        run_collect(CONFIG_PATH)


@app.on_event("startup")
async def startup_event():
    cfg = load_config(CONFIG_PATH)
    # schedule twice per day; override with WEB_CRON if provided (e.g., "0 1,13 * * *")
    cron_env = os.environ.get("WEB_CRON")
    if cron_env:
        # user provided cron in 5-part format; default timezone UTC
        parts = cron_env.split()
        if len(parts) == 5:
            scheduler.add_job(scheduled_run, CronTrigger.from_crontab(cron_env))
    else:
        # default: run at 01:00 and 13:00 UTC
        scheduler.add_job(scheduled_run, CronTrigger(hour="1,13", minute=0))
    scheduler.start()


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    cfg = load_config(CONFIG_PATH)
    cols = get_db_collections(cfg)
    last_runs = list(cols["runs"].find().sort("finished_at", -1).limit(20))
    last_run = last_runs[0] if last_runs else None
    # Scheduler next run info (may be None if not scheduled)
    next_runs = scheduler.get_jobs()
    next_run_time = next_runs[0].next_run_time if next_runs else None
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "title": APP_TITLE,
            "last_run": last_run,
            "last_runs": last_runs,
            "next_run_time": next_run_time,
        },
    )


@app.post("/run")
async def run_now():
    if _RUN_LOCK.locked():
        return JSONResponse({"status": "busy", "detail": "A run is already in progress"}, status_code=409)
    async with _RUN_LOCK:
        run = await asyncio.to_thread(run_collect, CONFIG_PATH)
        return JSONResponse({"status": "ok", "run": run})


@app.get("/api/runs")
async def api_runs(limit: int = 20):
    cfg = load_config(CONFIG_PATH)
    cols = get_db_collections(cfg)
    docs = list(cols["runs"].find().sort("finished_at", -1).limit(limit))
    # convert datetimes to isoformat
    for d in docs:
        for k in ("started_at", "finished_at"):
            if k in d and d[k] is not None:
                d[k] = d[k].isoformat()
        d["_id"] = str(d["_id"])  # stringify ObjectId
    return JSONResponse(docs)


# For Render.com, provide an entrypoint command in README or render.yaml like:
# uvicorn web_app:app --host 0.0.0.0 --port 10000
