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


@app.get("/ads", response_class=HTMLResponse)
async def ads_page(request: Request,
                   q: str | None = None,
                   brand: str | None = None,
                   model: str | None = None,
                   reg_from: str | None = None,
                   reg_to: str | None = None,
                   min_price: float | None = None,
                   max_price: float | None = None,
                   page: int = 1,
                   page_size: int = 20):
    cfg = load_config(CONFIG_PATH)
    supa, sb_cfg = get_supabase(cfg)
    table_ads = sb_cfg.get("ads_table", "ads")

    # Build query
    query = supa.table(table_ads).select("unique_key,subject,car_brand,car_model,regdate,price,first_publication_date,index_date,location_city,location_zipcode").order("first_publication_date", desc=True)

    if brand:
        query = query.ilike("car_brand", f"%{brand}%")
    if model:
        query = query.ilike("car_model", f"%{model}%")
    if q:
        query = query.or_(
            f"subject.ilike.%{q}%,car_model.ilike.%{q}%,car_brand.ilike.%{q}%"
        )
    if min_price is not None:
        query = query.gte("price", min_price)
    if max_price is not None:
        query = query.lte("price", max_price)
    # regdate expected like YYYY or YYYY-MM; we filter using ilike if string
    if reg_from:
        query = query.gte("regdate", reg_from)
    if reg_to:
        query = query.lte("regdate", reg_to)

    # pagination
    page = max(1, page)
    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.range(start, end).execute()
    rows = res.data or []

    return templates.TemplateResponse(
        "ads.html",
        {
            "request": request,
            "title": f"{APP_TITLE} · Annonces",
            "rows": rows,
            "page": page,
            "page_size": page_size,
            "filters": {"q": q or "", "brand": brand or "", "model": model or "", "reg_from": reg_from or "", "reg_to": reg_to or "", "min_price": min_price or "", "max_price": max_price or ""},
        },
    )


# For Render.com, provide an entrypoint command in README or render.yaml like:
# uvicorn web_app:app --host 0.0.0.0 --port 10000
