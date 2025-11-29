"""
FastAPI web app providing:
- Dashboard: last run info, recent runs, next scheduled run, button to run now
- API endpoints to fetch runs and trigger a run
- APScheduler to run collector every 30 minutes by default

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

from run_collector import run_collect, load_config, get_db_client

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
        # Default: run every 30 minutes
        scheduler.add_job(scheduled_run, CronTrigger(minute="*/10"))
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


def get_db(cfg):
    """Get database client and config."""
    db_client, db_type = get_db_client(cfg)
    mysql_cfg = cfg.get("mysql", {})
    return db_client, mysql_cfg, db_type


async def scheduled_run():
    async with _RUN_LOCK:
        # Run LBC then mobilede sequentially by controlling SOURCES env var
        prev = os.environ.get("SOURCES")
        try:
            os.environ["SOURCES"] = "lbc"
            await asyncio.to_thread(run_collect, CONFIG_PATH)
            os.environ["SOURCES"] = "mobilede"
            await asyncio.to_thread(run_collect, CONFIG_PATH)
        finally:
            if prev is not None:
                os.environ["SOURCES"] = prev
            else:
                os.environ.pop("SOURCES", None)


 


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    cfg = load_config(CONFIG_PATH)
    db_client, db_cfg, db_type = get_db(cfg)
    table_runs = db_cfg.get("runs_table", "runs")
    lbc_table = db_cfg.get("lbc_table", "ads_lbc")
    mobilede_table = db_cfg.get("mobilede_table", "ads_mobilede")
    
    # Get last runs ordered by finished_at desc
    res = db_client.table(table_runs).select("*").order("finished_at", desc=True).limit(20).execute()
    last_runs = res.data or []
    last_run = last_runs[0] if last_runs else None
    
    # Get counts for each table
    try:
        if db_type == "mysql":
            lbc_count = db_client.table(lbc_table).count()
        else:
            lbc_count_res = db_client.table(lbc_table).select("unique_key", count="exact").limit(1).execute()
            lbc_count = lbc_count_res.count if hasattr(lbc_count_res, 'count') else 0
    except Exception as e:
        print(f"Error getting LBC count: {e}")
        import traceback
        traceback.print_exc()
        lbc_count = 0
    
    try:
        if db_type == "mysql":
            mobilede_count = db_client.table(mobilede_table).count()
        else:
            mobilede_count_res = db_client.table(mobilede_table).select("unique_key", count="exact").limit(1).execute()
            mobilede_count = mobilede_count_res.count if hasattr(mobilede_count_res, 'count') else 0
    except Exception as e:
        print(f"Error getting Mobile.de count: {e}")
        import traceback
        traceback.print_exc()
        mobilede_count = 0
    
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
            "lbc_count": lbc_count,
            "mobilede_count": mobilede_count,
            "total_count": lbc_count + mobilede_count,
        },
    )


@app.post("/run")
async def run_now():
    if _RUN_LOCK.locked():
        return JSONResponse({"status": "busy", "detail": "A run is already in progress"}, status_code=409)
    async with _RUN_LOCK:
        prev = os.environ.get("SOURCES")
        results = []
        try:
            os.environ["SOURCES"] = "lbc"
            res_lbc = await asyncio.to_thread(run_collect, CONFIG_PATH)
            results.append({"source": "lbc", "result": res_lbc})
            os.environ["SOURCES"] = "mobilede"
            res_mob = await asyncio.to_thread(run_collect, CONFIG_PATH)
            results.append({"source": "mobilede", "result": res_mob})
        finally:
            if prev is not None:
                os.environ["SOURCES"] = prev
            else:
                os.environ.pop("SOURCES", None)
        return JSONResponse({"status": "ok", "runs": results})


@app.get("/api/runs")
async def api_runs(limit: int = 20):
    cfg = load_config(CONFIG_PATH)
    db_client, db_cfg, db_type = get_db(cfg)
    table_runs = db_cfg.get("runs_table", "runs")
    res = db_client.table(table_runs).select("*").order("finished_at", desc=True).limit(limit).execute()
    docs = res.data or []
    return JSONResponse(docs)


@app.get("/ads", response_class=HTMLResponse)
async def ads_page(
    request: Request,
    q: str | None = None,
    brand: str | None = None,
    model: str | None = None,
    reg_from: str | None = None,
    reg_to: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    source: str = "all",  # lbc | mobilede | all
    page: int = 1,
    page_size: int = 20,
):
    cfg = load_config(CONFIG_PATH)
    db_client, db_cfg, db_type = get_db(cfg)
    lbc_table = db_cfg.get("lbc_table", "ads_lbc")
    mobilede_table = db_cfg.get("mobilede_table", "ads_mobilede")

    def build_query(table_name: str):
        qbuilder = db_client.table(table_name).select(
            "unique_key,subject,car_brand,car_model,regdate,price,first_publication_date,index_date,location_city,location_zipcode,url"
        ).order("first_publication_date", desc=True)
        if brand:
            qbuilder = qbuilder.ilike("car_brand", f"%{brand}%")
        if model:
            qbuilder = qbuilder.ilike("car_model", f"%{model}%")
        if q:
            qbuilder = qbuilder.or_(
                f"subject.ilike.%{q}%,car_model.ilike.%{q}%,car_brand.ilike.%{q}%"
            )
        if min_price is not None:
            qbuilder = qbuilder.gte("price", min_price)
        if max_price is not None:
            qbuilder = qbuilder.lte("price", max_price)
        if reg_from:
            qbuilder = qbuilder.gte("regdate", reg_from)
        if reg_to:
            qbuilder = qbuilder.lte("regdate", reg_to)
        return qbuilder

    page = max(1, page)
    start = (page - 1) * page_size
    end = start + page_size - 1

    rows: list[dict] = []
    selected_source = source.lower().strip()
    
    try:
        if selected_source == "lbc":
            res = build_query(lbc_table).range(start, end).execute()
            rows = res.data or []
        elif selected_source == "mobilede":
            res = build_query(mobilede_table).range(start, end).execute()
            rows = res.data or []
        else:  # all -> merge in memory
            # fetch a bit more from each to improve merged pagination
            fetch_each = page_size
            res1 = build_query(lbc_table).range(0, fetch_each - 1).execute()
            res2 = build_query(mobilede_table).range(0, fetch_each - 1).execute()
            r1 = res1.data or []
            r2 = res2.data or []
            merged = r1 + r2
            def _dt_key(r):
                # sort by first_publication_date desc, fallback index_date
                fp = r.get("first_publication_date") or ""
                idx = r.get("index_date") or ""
                return (fp or idx or "")
            merged.sort(key=_dt_key, reverse=True)
            rows = merged[start:end + 1]
    except Exception as e:
        print(f"Error fetching ads: {e}")
        rows = []

    return templates.TemplateResponse(
        "ads.html",
        {
            "request": request,
            "title": f"{APP_TITLE} · Annonces",
            "rows": rows,
            "page": page,
            "page_size": page_size,
            "filters": {"q": q or "", "brand": brand or "", "model": model or "", "reg_from": reg_from or "", "reg_to": reg_to or "", "min_price": min_price or "", "max_price": max_price or ""},
            "source": selected_source,
        },
    )


# For Render.com, provide an entrypoint command in README or render.yaml like:
# uvicorn web_app:app --host 0.0.0.0 --port 10000
