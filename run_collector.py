"""
Automated collector script: runs the ScraperCars pipeline and persists results into Supabase (Postgres).

Features:
- Reads API, headers, cookies, client, and Supabase settings from config.ini
- Retries scraping on errors (configurable)
- Upserts ads into Supabase with a unique key to avoid duplicates
- Stores run metadata (success/failure, counts, error) in a 'runs' table

Intended to be scheduled (e.g., cron) to run twice per day on a VPS.
"""
import argparse
import configparser
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from ScraperCars import ScraperCars

try:
    from supabase import create_client, Client
except Exception as e:
    raise ImportError("supabase is required. Install with 'pip install supabase'")

try:
    import psycopg
except Exception:
    psycopg = None  # DSN-based init optional


logger = logging.getLogger("collector")
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(handler)
logger.setLevel(logging.INFO)


def load_config(path: str) -> Dict[str, Dict[str, Any]]:
    cfg = configparser.ConfigParser()
    cfg.read(path)
    out: Dict[str, Dict[str, Any]] = {"api": {}, "headers": {}, "cookies": {}, "client": {}, "supabase": {}}

    if cfg.has_section("api"):
        for k, v in cfg.items("api"):
            try:
                out["api"][k] = json.loads(v)
            except Exception:
                out["api"][k] = v

    if cfg.has_section("headers"):
        out["headers"] = dict(cfg.items("headers"))

    if cfg.has_section("cookies"):
        out["cookies"] = dict(cfg.items("cookies"))

    if cfg.has_section("client"):
        out["client"] = dict(cfg.items("client"))

    if cfg.has_section("supabase"):
        out["supabase"] = dict(cfg.items("supabase"))

    return out


def get_supabase_client(sb_cfg: Dict[str, Any]) -> Client:
    url = sb_cfg.get("url")
    key = sb_cfg.get("key")
    if not url or not key:
        raise RuntimeError("Supabase config requires url and key in [supabase] section")
    return create_client(url, key)


def init_supabase_tables_if_needed(sb_cfg: Dict[str, Any], schema_sql_path: str = "supabase_schema.sql"):
    """Optionally initialize tables via Postgres DSN if provided in config under supabase.dsn.
    This requires psycopg and a service role DSN (postgresql://user:pass@host:port/dbname).
    If DSN not provided or psycopg missing, do nothing (user can apply SQL manually).
    """
    dsn = sb_cfg.get("dsn")
    if not dsn or not psycopg:
        return
    try:
        with open(schema_sql_path, "r", encoding="utf-8") as f:
            sql_text = f.read()
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(sql_text)
                conn.commit()
        logger.info("Supabase tables initialization completed (if not existing)")
    except Exception as e:
        logger.warning("Supabase tables init skipped/failed: %s", e)


def compute_unique_key(ad: Dict[str, Any]) -> Optional[str]:
    # Prefer numeric list_id
    if "list_id" in ad and ad["list_id"]:
        return str(ad["list_id"])  # string for index stability
    # Try generic id
    if "id" in ad and ad["id"]:
        return str(ad["id"])
    # Try derive from URL (last path segment is typically the id)
    url = ad.get("url")
    if url and "/" in url:
        seg = url.rstrip("/").split("/")[-1]
        if seg:
            return seg
    return None

def _chunked(iterable, size):
    for i in range(0, len(iterable), size):
        yield iterable[i : i + size]


def _try_int(x) -> Optional[int]:
    try:
        if x is None:
            return None
        return int(str(x).strip())
    except Exception:
        return None


def _parse_dt(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    # Try several known formats
    fmts = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
    ]
    for f in fmts:
        try:
            dt = datetime.strptime(s, f)
            # If naive, assume UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except Exception:
            continue
    # fallback: return None
    return None


def _attr(attrs: List[Dict[str, Any]], key: str) -> Optional[Dict[str, Any]]:
    if not isinstance(attrs, list):
        return None
    for a in attrs:
        if a.get("key") == key:
            return a
    return None


def _attr_val_label(attrs: List[Dict[str, Any]], key: str) -> Optional[str]:
    a = _attr(attrs, key)
    if not a:
        return None
    return a.get("value_label") or a.get("value")


def map_ad_to_row(ad: Dict[str, Any]) -> Dict[str, Any]:
    attrs = ad.get("attributes") or []
    images = ad.get("images") or {}
    loc = ad.get("location") or {}
    owner = ad.get("owner") or {}

    price = None
    if isinstance(ad.get("price"), list) and ad["price"]:
        try:
            price = float(ad["price"][0])
        except Exception:
            price = None

    row = {
        "unique_key": compute_unique_key(ad),
        "list_id": _try_int(ad.get("list_id")),
        "url": ad.get("url"),
        "subject": ad.get("subject"),
        "body": ad.get("body"),
        "category_id": ad.get("category_id"),
        "category_name": ad.get("category_name"),
        "ad_type": ad.get("ad_type"),
        "status": ad.get("status"),
        "price_cents": _try_int(ad.get("price_cents")),
        "price": price,
        "first_publication_date": _parse_dt(ad.get("first_publication_date")),
        "expiration_date": _parse_dt(ad.get("expiration_date")),
        "index_date": _parse_dt(ad.get("index_date")),
        "has_phone": bool(ad.get("has_phone")) if ad.get("has_phone") is not None else None,
        # images
        "images_nb": _try_int(images.get("nb_images")),
        "images_thumb_url": images.get("thumb_url"),
        "images_small_url": images.get("small_url"),
        "images_urls": images.get("urls"),
        "images_urls_thumb": images.get("urls_thumb"),
        "images_urls_large": images.get("urls_large"),
        # location
        "location_country_id": loc.get("country_id"),
        "location_region_id": loc.get("region_id"),
        "location_region_name": loc.get("region_name"),
        "location_department_id": loc.get("department_id"),
        "location_department_name": loc.get("department_name"),
        "location_city": loc.get("city") or loc.get("city_label"),
        "location_zipcode": loc.get("zipcode"),
        "location_lat": loc.get("lat"),
        "location_lng": loc.get("lng"),
        # owner
        "owner_store_id": owner.get("store_id"),
        "owner_user_id": owner.get("user_id"),
        "owner_type": owner.get("type"),
        "owner_name": owner.get("name"),
        # attributes main
        "car_brand": _attr_val_label(attrs, "brand") or _attr_val_label(attrs, "u_car_brand"),
        "car_model": _attr_val_label(attrs, "model") or _attr_val_label(attrs, "u_car_model"),
        "regdate": _attr_val_label(attrs, "regdate"),
        "mileage": _try_int(_attr_val_label(attrs, "mileage")),
        "fuel_label": _attr_val_label(attrs, "fuel"),
        "gearbox_label": _attr_val_label(attrs, "gearbox"),
        "doors": _try_int(_attr_val_label(attrs, "doors")),
        "seats": _try_int(_attr_val_label(attrs, "seats")),
        "issuance_date": _attr_val_label(attrs, "issuance_date"),
        "vehicle_type": _attr_val_label(attrs, "vehicle_type"),
        "vehicule_color": _attr_val_label(attrs, "vehicule_color"),
        "critair": _try_int(_attr_val_label(attrs, "critair")),
        "horsepower_fiscal": _try_int(_attr_val_label(attrs, "horsepower")),
        "horsepower_din": _try_int(_attr_val_label(attrs, "horse_power_din")),
        # raw for safety/debug
        "raw": ad,
    }
    return row


def upsert_ads_supabase(supa: Client, table_ads: str, ads: List[Dict[str, Any]], chunk_size: int = 200) -> Dict[str, int]:
    inserted = 0
    updated = 0
    skipped = 0
    keys: List[str] = []
    mapped: Dict[str, Dict[str, Any]] = {}
    for ad in ads:
        row = map_ad_to_row(ad)
        ukey = row.get("unique_key")
        if not ukey:
            skipped += 1
            continue
        keys.append(ukey)
        mapped[ukey] = row

    # Fetch existing keys to preserve first_seen semantics
    existing_set = set()
    for batch in _chunked(keys, 1000):
        res = supa.table(table_ads).select("unique_key").in_("unique_key", batch).execute()
        rows = res.data or []
        for r in rows:
            existing_set.add(r.get("unique_key"))

    now_iso = datetime.now(timezone.utc).isoformat()
    new_rows = []
    upd_rows = []
    for k in keys:
        row = mapped[k]
        row["updated_at"] = now_iso
        if k in existing_set:
            upd_rows.append(row)
        else:
            row["first_seen_at"] = now_iso
            new_rows.append(row)

    # Upsert existing (on_conflict still used but we expect UPDATE path)
    for batch in _chunked(upd_rows, chunk_size):
        if not batch:
            continue
        supa.table(table_ads).upsert(batch, on_conflict="unique_key").execute()
        updated += len(batch)

    # Insert new with upsert to handle race conditions
    for batch in _chunked(new_rows, chunk_size):
        if not batch:
            continue
        supa.table(table_ads).upsert(batch, on_conflict="unique_key").execute()
        inserted += len(batch)

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def run_collect(
    config_path: str,
    max_results: int = 1000,
    max_retries: int = 3,
    retry_sleep: int = 30,
):
    """Run one collection cycle with retries; returns dict with run metadata and stats.
    Return keys: success, attempts, count_scraped, stats, error (optional), started_at, finished_at.
    """
    cfg = load_config(config_path)
    client_cfg = cfg.get("client", {})
    impersonate = client_cfg.get("impersonate", "chrome141")

    scraper = ScraperCars(
        max_results=max_results,
        params=cfg.get("api", {}),
        headers=cfg.get("headers", {}),
        cookies=cfg.get("cookies", {}),
        impersonate=impersonate,
        ini_path=config_path,
    )

    sb_cfg = cfg.get("supabase", {})
    if not sb_cfg:
        raise RuntimeError(f"Missing [supabase] configuration in {config_path}")
    table_ads = sb_cfg.get("ads_table", "ads")
    table_runs = sb_cfg.get("runs_table", "runs")
    # optional init using DSN if provided
    init_supabase_tables_if_needed(sb_cfg)
    supa = get_supabase_client(sb_cfg)

    attempt = 0
    start_time = datetime.now(timezone.utc)
    last_error = None
    while attempt < max_retries:
        attempt += 1
        try:
            logger.info("Starting scrape attempt %d", attempt)
            ads = scraper.scrape()
            logger.info("Scraped %d ads", len(ads))

            stats = upsert_ads_supabase(supa, table_ads, ads)
            logger.info("Upsert stats: %s", stats)

            run_doc = {
                "started_at": start_time.isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "attempts": attempt,
                "success": True,
                "count_scraped": len(ads),
                "stats": stats,
            }
            supa.table(table_runs).insert(run_doc).execute()
            return run_doc
        except Exception as e:
            last_error = str(e)
            logger.error("Run attempt %d failed: %s", attempt, e)
            if attempt < max_retries:
                time.sleep(retry_sleep)
                continue
            else:
                try:
                    run_doc = {
                        "started_at": start_time.isoformat(),
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                        "attempts": attempt,
                        "success": False,
                        "error": last_error,
                    }
                    supa.table(table_runs).insert(run_doc).execute()
                except Exception as e2:
                    logger.error("Failed to log failed run to Supabase: %s", e2)
                    run_doc = run_doc
                return run_doc


def main():
    parser = argparse.ArgumentParser(description="Run scraper and persist to MongoDB")
    parser.add_argument("--config", default="config.ini", help="Path to config.ini")
    parser.add_argument("--max", type=int, default=1000, help="Max results to fetch")
    parser.add_argument("--max-retries", type=int, default=3, help="Max retries on failure for the whole run")
    parser.add_argument("--retry-sleep", type=int, default=30, help="Seconds to sleep between retries")
    args = parser.parse_args()
    run = run_collect(
        config_path=args.config,
        max_results=args.max,
        max_retries=args.max_retries,
        retry_sleep=args.retry_sleep,
    )
    return 0 if run.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
