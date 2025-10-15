"""
Automated collector script: runs the ScraperLBC pipeline and persists results into Supabase (Postgres).

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
import traceback
from typing import Dict, Any, List, Optional
import sqlite3

from scrapers.ScraperLBC import ScraperLBC
try:
    from scrapers.ScraperMobilede import ScraperMobilede
except Exception:
    ScraperMobilede = None  # optional

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
    out: Dict[str, Dict[str, Any]] = {"api": {}, "headers": {}, "cookies": {}, "client": {}, "supabase": {}, "collector": {}}

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

    if cfg.has_section("collector"):
        out["collector"] = dict(cfg.items("collector"))

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
    """Return a source-prefixed unique key to avoid cross-source collisions.

    Format: "{src}:{key}", where src ∈ {lbc, mobilede} derived from ad['source'] or URL.
    Key is preferably list_id or id, falling back to URL tail.
    """
    url = ad.get("url") or ""
    src = (ad.get("source") or "").lower()
    if not src:
        if "automobile.fr" in url:
            src = "mobilede"
        elif "leboncoin.fr" in url:
            src = "lbc"
        else:
            src = "lbc"  # default

    key_part: Optional[str] = None
    if ad.get("list_id"):
        key_part = str(ad["list_id"])  # canonical numeric
    elif ad.get("id"):
        key_part = str(ad["id"])
    elif url and "/" in url:
        seg = url.rstrip("/").split("/")[-1]
        if seg:
            key_part = seg

    if not key_part:
        return None
    return f"{src}:{key_part}"

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


def map_lbc_to_row(ad: Dict[str, Any]) -> Dict[str, Any]:
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


def map_mobile_to_row(ad: Dict[str, Any]) -> Dict[str, Any]:
    """Map a Mobile.de ad into a normalized, JSON-safe row ready for Supabase insertion."""

    def safe(obj):
        """Recursively convert any object into JSON-safe equivalents."""
        if obj is None or isinstance(obj, (bool, int, float, str)):
            return obj
        if isinstance(obj, (list, tuple, set)):
            return [safe(x) for x in obj]
        if isinstance(obj, dict):
            return {str(k): safe(v) for k, v in obj.items()}
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        try:
            return json.loads(json.dumps(obj, default=str))
        except Exception:
            return str(obj)

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

    def av(keys: List[str]) -> Optional[str]:
        """Try alternative keys for attribute lookup."""
        for k in keys:
            v = _attr_val_label(attrs, k)
            if v not in (None, ""):
                return v
        return None

    car_brand = av(["brand", "make", "manufacturer"]) or ad.get("brand")
    car_model = av(["model", "model_name", "series"]) or ad.get("model")
    regdate = av(["regdate", "first_registration", "first_reg"]) or ad.get("regdate")
    mileage = av(["mileage", "kilometer", "kilometrage", "mileage_km"]) or ad.get("mileage")
    fuel_label = av(["fuel", "fuel_type"]) or ad.get("fuel")
    gearbox_label = av(["gearbox", "transmission"]) or ad.get("gearbox")
    doors = av(["doors"]) or ad.get("doors")
    seats = av(["seats"]) or ad.get("seats")
    issuance_date = av(["issuance_date"]) or ad.get("issuance_date")
    vehicle_type = av(["vehicle_type", "body_type", "body"]) or ad.get("vehicle_type")
    vehicule_color = av(["vehicule_color", "color"]) or ad.get("vehicule_color") or ad.get("color")
    critair = av(["critair"]) or ad.get("critair")
    horsepower_fiscal = av(["horsepower", "horsepower_fiscal"]) or ad.get("horsepower")
    horsepower_din = av(["horse_power_din", "power_hp"]) or ad.get("horse_power_din") or ad.get("power_hp")

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

        # Images
        "images_nb": _try_int(images.get("nb_images")),
        "images_thumb_url": images.get("thumb_url"),
        "images_small_url": images.get("small_url"),
        "images_urls": safe(images.get("urls")),
        "images_urls_thumb": safe(images.get("urls_thumb")),
        "images_urls_large": safe(images.get("urls_large")),

        # Location
        "location_country_id": loc.get("country_id"),
        "location_region_id": loc.get("region_id"),
        "location_region_name": loc.get("region_name"),
        "location_department_id": loc.get("department_id"),
        "location_department_name": loc.get("department_name"),
        "location_city": loc.get("city") or loc.get("city_label"),
        "location_zipcode": loc.get("zipcode"),
        "location_lat": loc.get("lat"),
        "location_lng": loc.get("lng"),

        # Owner
        "owner_store_id": owner.get("store_id"),
        "owner_user_id": owner.get("user_id"),
        "owner_type": owner.get("type"),
        "owner_name": owner.get("name"),

        # Vehicle details
        "car_brand": car_brand,
        "car_model": car_model,
        "regdate": regdate,
        "mileage": _try_int(mileage),
        "fuel_label": fuel_label,
        "gearbox_label": gearbox_label,
        "doors": _try_int(doors),
        "seats": _try_int(seats),
        "issuance_date": issuance_date,
        "vehicle_type": vehicle_type,
        "vehicule_color": vehicule_color,
        "critair": _try_int(critair),
        "horsepower_fiscal": _try_int(horsepower_fiscal),
        "horsepower_din": _try_int(horsepower_din),

        # JSON-safe raw backup
        "raw": safe(ad),
    }

    # Make sure all datetimes are strings before returning
    return {k: safe(v) for k, v in row.items()}



def upsert_lbc_supabase(supa: Client, lbc_table: str, ads: List[Dict[str, Any]], chunk_size: int = 200) -> Dict[str, int]:
    inserted = 0
    updated = 0
    skipped = 0
    keys: List[str] = []
    mapped: Dict[str, Dict[str, Any]] = {}
    for ad in ads:
        row = map_lbc_to_row(ad)
        ukey = row.get("unique_key")
        if not ukey:
            skipped += 1
            continue
        keys.append(ukey)
        mapped[ukey] = row

    # Fetch existing keys to preserve first_seen semantics
    existing_set = set()
    for batch in _chunked(keys, 1000):
        res = supa.table(lbc_table).select("unique_key").in_("unique_key", batch).execute()
        rows = res.data or []
        for r in rows:
            existing_set.add(r.get("unique_key"))
    logger.info(f"Len existing in cloud and rescraped: {len(existing_set)}")
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
    try:
        for batch in _chunked(upd_rows, chunk_size):
            if not batch:
                continue
            supa.table(lbc_table).upsert(batch, on_conflict="unique_key").execute()
            updated += len(batch)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error upserting existing rows: {e}")

    # Insert new with upsert to handle race conditions
    try:
        for batch in _chunked(new_rows, chunk_size):
            if not batch:
                continue
            supa.table(lbc_table).upsert(batch, on_conflict="unique_key").execute()
            inserted += len(batch)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error inserting new rows: {e}")

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def upsert_mobile_supabase(supa: Client, mobile_table: str, ads: List[Dict[str, Any]], chunk_size: int = 200) -> Dict[str, int]:
    inserted = 0
    updated = 0
    skipped = 0
    keys: List[str] = []
    mapped: Dict[str, Dict[str, Any]] = {}
    for ad in ads:
        row = map_mobile_to_row(ad)
        ukey = row.get("list_id")
        if not ukey:
            skipped += 1
            continue
        keys.append(ukey)
        mapped[ukey] = row

    # Fetch existing keys to preserve first_seen semantics
    existing_set = set()
    try:
        for batch in _chunked(keys, 1000):
            res = supa.table(mobile_table).select("list_id").in_("list_id", batch).execute()
            rows = res.data or []
            for r in rows:
                existing_set.add(r.get("list_id"))
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error fetching existing keys: {e}")

    logger.info(f"Len existing in cloud and rescraped: {len(existing_set)}")
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
    try:
        # Upsert existing (on_conflict still used but we expect UPDATE path)
        for batch in _chunked(upd_rows, chunk_size):
            if not batch:
                continue
            supa.table(mobile_table).upsert(batch, on_conflict="unique_key").execute()
            updated += len(batch)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error upserting existing rows: {e}")
    # Insert new with upsert to handle race conditions
    try:
        for batch in _chunked(new_rows, chunk_size):
            if not batch:
                continue
            supa.table(mobile_table).upsert(batch, on_conflict="unique_key").execute()
            inserted += len(batch)
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error inserting new rows: {e}")


    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def run_collect(
    config_path: str,
    max_results: int = 1000,
    max_retries: int = 3,
    retry_sleep: int = 30,
    nodup: bool = True,
):
    """Run one collection cycle with retries; returns dict with run metadata and stats.
    Return keys: success, attempts, count_scraped, stats, error (optional), started_at, finished_at.
    """
    cfg = load_config(config_path)
    client_cfg = cfg.get("client", {})
    impersonate = client_cfg.get("impersonate", "chrome131")

    # Load existing IDs from local SQLite cache if nodup
    existing_ids_set = None
    db_path = os.path.join(os.path.dirname(config_path) or ".", "local_cache.db")
    if nodup:
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS seen_ids (id TEXT PRIMARY KEY)")
            cur.execute("SELECT id FROM seen_ids")
            rows = cur.fetchall()
            existing_lbc_ids_set = {r[0] for r in rows}
            conn.close()
        except Exception as e:
            logger.warning("Failed to open local cache: %s", e)
            existing_lbc_ids_set = None
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("CREATE TABLE IF NOT EXISTS seen_mobilede_ids (id TEXT PRIMARY KEY)")
            cur.execute("SELECT id FROM seen_mobilede_ids")
            rows = cur.fetchall()
            existing_mobilede_ids_set = {r[0] for r in rows}
            conn.close()
        except Exception as e:
            logger.warning("Failed to open local cache: %s", e)
            existing_mobilede_ids_set = None

    # Decide sources: default to both lbc and mobilede
    collector_cfg = cfg.get("collector", {})
    sources_raw = (
        collector_cfg.get("sources")
        or collector_cfg.get("source")
        or os.environ.get("SOURCES")
        or os.environ.get("SOURCE")
        or "lbc,mobilede"
    )
    wanted = [s.strip().lower() for s in sources_raw.split(",") if s.strip()]
    # normalize and preserve order, keep only supported
    normalized: List[str] = []
    for s in wanted:
        if s in ("lbc", "leboncoin") and "lbc" not in normalized:
            normalized.append("lbc")
        elif s in ("mobilede", "automobile") and "mobilede" not in normalized:
            normalized.append("mobilede")
    if not normalized:
        normalized = ["lbc", "mobilede"]

    sb_cfg = cfg.get("supabase", {})
    if not sb_cfg:
        raise RuntimeError(f"Missing [supabase] configuration in {config_path}")
    lbc_table = sb_cfg.get("lbc_table", "ads")
    mobilede_table = sb_cfg.get("mobilede_table", "ads")
    table_runs = sb_cfg.get("runs_table", "runs")
    # optional init using DSN if provided
    init_supabase_tables_if_needed(sb_cfg)
    supa = get_supabase_client(sb_cfg)

    attempt = 0
    start_time = datetime.now(timezone.utc)
    last_error = None
    logger.info(f"Sources to scrape: {normalized}")
    logger.info("Starting with LBC")
    while attempt < max_retries:
        attempt += 1
        try:
            logger.info(f"Starting scrape attempt {attempt}")

            ads_all: List[Dict[str, Any]] = []
            source_counts: Dict[str, int] = {}

            scraper = ScraperLBC(
                max_results=max_results,
                params=cfg.get("api", {}),
                headers=cfg.get("headers", {}),
                cookies=cfg.get("cookies", {}),
                impersonate=impersonate,
                ini_path=config_path,
                existing_ids=existing_lbc_ids_set,
                stop_on_known=nodup,
            )


            ads = scraper.scrape()
            logger.info("[%s] Scraped %d ads", "LBC", len(ads))
            source_counts["LBC"] = len(ads)

            logger.info("Total scraped across sources: %d", len(ads))

            stats = upsert_lbc_supabase(supa, lbc_table, ads)
            # persist seen ids locally for future runs
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute("CREATE TABLE IF NOT EXISTS seen_ids (id TEXT PRIMARY KEY)")
                to_ins = []
                for a in ads:
                    ad_id = a.get("id") or a.get("list_id") or a.get("unique_key")
                    if ad_id:
                        to_ins.append((str(ad_id),))
                if to_ins:
                    cur.executemany("INSERT OR IGNORE INTO seen_ids(id) VALUES(?)", to_ins)
                    conn.commit()
                conn.close()
            except Exception as e:
                logger.warning("Failed to update local cache: %s", e)
            logger.info("Upsert stats: %s", stats)

            run_doc_lbc = {
                "source": "LBC",
                "started_at": start_time.isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "attempts": attempt,
                "success": True,
                "count_scraped": len(ads),
                "stats": {**stats, "source_counts": source_counts},
            }
            supa.table(table_runs).insert(run_doc_lbc).execute()
            break  # success, exit retry loop
        except Exception as e:
            last_error = str(e)
            logger.error("Run attempt %d failed: %s", attempt, e)
            if attempt < max_retries:
                time.sleep(retry_sleep)
                continue
            else:
                try:
                    run_doc_lbc = {
                        "source": "LBC",
                        "started_at": start_time.isoformat(),
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                        "attempts": attempt,
                        "success": False,
                        "error": last_error,
                    }
                    supa.table(table_runs).insert(run_doc_lbc).execute()
                except Exception as e2:
                    logger.error("Failed to log failed run to Supabase: %s", e2)
                    run_doc_lbc = run_doc_lbc
                

    logger.info("Now doing Mobilede")
    attempt = 0
    start_time = datetime.now(timezone.utc)
    last_error = None
    while attempt < max_retries:
        attempt += 1
        try:
            logger.info("Starting scrape attempt %d", attempt)

            ads_all: List[Dict[str, Any]] = []
            source_counts: Dict[str, int] = {}

            scraper = ScraperMobilede(
                max_results=max_results,
                impersonate=impersonate,
                existing_ids=existing_mobilede_ids_set,
                stop_on_known=nodup,
            )
            ads = []
            ads = scraper.scrape()
            logger.info("[%s] Scraped %d ads", "Mobile", len(ads))
            source_counts["Mobile"] = len(ads)
            logger.info("Total scraped across sources: %d", len(ads))

            stats = upsert_mobile_supabase(supa, mobilede_table, ads)
            # persist seen ids locally for future runs
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute("CREATE TABLE IF NOT EXISTS seen_mobilede_ids (id TEXT PRIMARY KEY)")
                to_ins = []
                for a in ads:
                    ad_id = a.get("unique_key") or a.get("list_id")
                    if ad_id:
                        to_ins.append((str(ad_id),))
                if to_ins:
                    cur.executemany("INSERT OR IGNORE INTO seen_mobilede_ids(id) VALUES(?)", to_ins)
                    conn.commit()
                conn.close()
            except Exception as e:
                logger.warning("Failed to update local cache: %s", e)
            logger.info("Upsert stats: %s", stats)

            run_doc_mobile = {
                "source": "Mobile",
                "started_at": start_time.isoformat(),
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "attempts": attempt,
                "success": True,
                "count_scraped": len(ads),
                "stats": {**stats, "source_counts": source_counts},
            }
            
            supa.table(table_runs).insert(run_doc_mobile).execute()
            break
        except Exception as e:
            last_error = str(e)
            logger.error("Run attempt %d failed: %s", attempt, e)
            if attempt < max_retries:
                time.sleep(retry_sleep)
                continue
            else:
                try:
                    run_doc_mobile = {
                        "source": "Mobile",
                        "started_at": start_time.isoformat(),
                        "finished_at": datetime.now(timezone.utc).isoformat(),
                        "attempts": attempt,
                        "success": False,
                        "error": last_error,
                    }
                    supa.table(table_runs).insert(run_doc_mobile).execute()
                except Exception as e2:
                    logger.error("Failed to log failed run to Supabase: %s", e2)
                    run_doc_mobile = run_doc_mobile
                
    success = (run_doc_lbc.get("success") if 'run_doc_lbc' in locals() else False) and (run_doc_mobile.get("success") if 'run_doc_mobile' in locals() else False)
    return {
        "success": success,
        "attempts": max(run_doc_lbc.get("attempts", 0) if 'run_doc_lbc' in locals() else 0, run_doc_mobile.get("attempts", 0) if 'run_doc_mobile' in locals() else 0),
        "count_scraped": (run_doc_lbc.get("count_scraped", 0) if 'run_doc_lbc' in locals() else 0) + (run_doc_mobile.get("count_scraped", 0) if 'run_doc_mobile' in locals() else 0),
        "stats": {
            "lbc": run_doc_lbc.get("stats") if 'run_doc_lbc' in locals() else {},
            "mobilede": run_doc_mobile.get("stats") if 'run_doc_mobile' in locals() else {},
        },
        "error": last_error,
        "started_at": (run_doc_lbc.get("started_at") if 'run_doc_lbc' in locals() else None) or (run_doc_mobile.get("started_at") if 'run_doc_mobile' in locals() else None),
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    

def main():
    parser = argparse.ArgumentParser(description="Run scraper and persist to MongoDB")
    parser.add_argument("--config", default="config.ini", help="Path to config.ini")
    parser.add_argument("--max", type=int, default=2000, help="Max results to fetch")
    parser.add_argument("--max-retries", type=int, default=3, help="Max retries on failure for the whole run")
    parser.add_argument("--retry-sleep", type=int, default=30, help="Seconds to sleep between retries")
    parser.add_argument("--nodup", action="store_true", help="Stop scraping when encountering an already-uploaded id (uses local cache)")
    args = parser.parse_args()
    run = run_collect(
        config_path=args.config,
        max_results=args.max,
        max_retries=args.max_retries,
        retry_sleep=args.retry_sleep,
        nodup=args.nodup,
    )
    return 0 if run.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
