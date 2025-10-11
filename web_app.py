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
from contextlib import asynccontextmanager
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from run_collector import run_collect, load_config, get_supabase_client

APP_TITLE = "LBC Collector"
CONFIG_PATH = os.environ.get("WEB_CONFIG", "config.ini")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # on startup
    cfg = load_config(CONFIG_PATH)
    cron_env = os.environ.get("WEB_CRON")
    if cron_env:
        parts = cron_env.split()
        if len(parts) == 5:
            scheduler.add_job(scheduled_run, CronTrigger.from_crontab(cron_env))
    else:
        scheduler.add_job(scheduled_run, CronTrigger(hour="1,13", minute=0))
    scheduler.start()
    try:
        yield
    finally:
        # on shutdown
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass

app = FastAPI(title=APP_TITLE, lifespan=lifespan)
templates = Jinja2Templates(directory="templates")


# Scheduling
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()
_RUN_LOCK = asyncio.Lock()


def get_supabase(cfg):
    sb_cfg = cfg.get("supabase", {})
    return get_supabase_client(sb_cfg), sb_cfg


async def scheduled_run():
    async with _RUN_LOCK:
        # run with defaults from config
        run_collect(CONFIG_PATH)


 


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    cfg = load_config(CONFIG_PATH)
    supa, sb_cfg = get_supabase(cfg)
    table_runs = sb_cfg.get("runs_table", "runs")
    # Get last runs ordered by finished_at desc
    res = supa.table(table_runs).select("*").order("finished_at", desc=True).limit(20).execute()
    last_runs = res.data or []
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
    supa, sb_cfg = get_supabase(cfg)
    table_runs = sb_cfg.get("runs_table", "runs")
    res = supa.table(table_runs).select("*").order("finished_at", desc=True).limit(limit).execute()
    docs = res.data or []
    return JSONResponse(docs)


# For Render.com, provide an entrypoint command in README or render.yaml like:
# uvicorn web_app:app --host 0.0.0.0 --port 10000
