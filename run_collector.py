"""
Automated collector script: runs the ScraperCars pipeline and persists results into MongoDB.

Features:
- Reads API, headers, cookies, client, and MongoDB settings from config.ini
- Retries scraping on errors (configurable)
- Upserts ads into MongoDB with a unique key to avoid duplicates
- Stores run metadata (success/failure, counts, error) in a 'runs' collection

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
    from pymongo import MongoClient, errors
except Exception as e:
    raise ImportError("pymongo is required. Install with 'pip install pymongo'")


logger = logging.getLogger("collector")
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(handler)
logger.setLevel(logging.INFO)


def load_config(path: str) -> Dict[str, Dict[str, Any]]:
    cfg = configparser.ConfigParser()
    cfg.read(path)
    out: Dict[str, Dict[str, Any]] = {"api": {}, "headers": {}, "cookies": {}, "client": {}, "mongodb": {}}

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

    if cfg.has_section("mongodb"):
        out["mongodb"] = dict(cfg.items("mongodb"))

    return out


def get_mongo_client(mongo_cfg: Dict[str, Any]) -> MongoClient:
    uri = mongo_cfg.get("uri")
    if uri:
        return MongoClient(uri)
    # build URI from parts
    host = mongo_cfg.get("host", "localhost")
    port = int(mongo_cfg.get("port", 27017))
    username = mongo_cfg.get("username")
    password = mongo_cfg.get("password")
    auth_source = mongo_cfg.get("authSource", "admin")
    if username and password:
        return MongoClient(host=host, port=port, username=username, password=password, authSource=auth_source)
    return MongoClient(host=host, port=port)


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


def ensure_indexes(collection) -> None:
    try:
        collection.create_index("unique_key", unique=True)
    except Exception as e:
        logger.warning("Index creation warning: %s", e)


def upsert_ads(collection, ads: List[Dict[str, Any]]) -> Dict[str, int]:
    inserted = 0
    updated = 0
    skipped = 0
    for ad in ads:
        ukey = compute_unique_key(ad)
        if not ukey:
            skipped += 1
            continue
        doc = dict(ad)
        doc["unique_key"] = ukey
        now = datetime.now(timezone.utc)
        try:
            res = collection.update_one(
                {"unique_key": ukey},
                {"$set": {**doc, "updated_at": now}, "$setOnInsert": {"first_seen_at": now}},
                upsert=True,
            )
            if res.upserted_id is not None:
                inserted += 1
            elif res.modified_count > 0:
                updated += 1
        except errors.DuplicateKeyError:
            skipped += 1
        except Exception as e:
            logger.error("Failed to upsert ad %s: %s", ukey, e)
            skipped += 1
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def run_collect(
    config_path: str,
    max_results: int = 100,
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
        ini_path=None,
    )

    mongo_cfg = cfg.get("mongodb", {})
    if not mongo_cfg:
        raise RuntimeError(f"Missing [mongodb] configuration in {config_path}")
    db_name = mongo_cfg.get("database", "leboncoin")
    col_name = mongo_cfg.get("collection", "ads")
    runs_collection_name = mongo_cfg.get("runs_collection", "runs")

    attempt = 0
    start_time = datetime.now(timezone.utc)
    last_error = None
    while attempt < max_retries:
        attempt += 1
        try:
            logger.info("Starting scrape attempt %d", attempt)
            ads = scraper.scrape()
            logger.info("Scraped %d ads", len(ads))

            mclient = get_mongo_client(mongo_cfg)
            db = mclient[db_name]
            col = db[col_name]
            runs_col = db[runs_collection_name]

            ensure_indexes(col)
            stats = upsert_ads(col, ads)
            logger.info("Upsert stats: %s", stats)

            run_doc = {
                "started_at": start_time,
                "finished_at": datetime.now(timezone.utc),
                "attempts": attempt,
                "success": True,
                "count_scraped": len(ads),
                "stats": stats,
            }
            runs_col.insert_one(run_doc)
            return run_doc
        except Exception as e:
            last_error = str(e)
            logger.error("Run attempt %d failed: %s", attempt, e)
            if attempt < max_retries:
                time.sleep(retry_sleep)
                continue
            else:
                try:
                    mclient = get_mongo_client(mongo_cfg)
                    db = mclient[db_name]
                    runs_col = db[runs_collection_name]
                    run_doc = {
                        "started_at": start_time,
                        "finished_at": datetime.now(timezone.utc),
                        "attempts": attempt,
                        "success": False,
                        "error": last_error,
                    }
                    runs_col.insert_one(run_doc)
                except Exception as e2:
                    logger.error("Failed to log failed run to Mongo: %s", e2)
                    run_doc = {
                        "started_at": start_time,
                        "finished_at": datetime.now(timezone.utc),
                        "attempts": attempt,
                        "success": False,
                        "error": last_error,
                    }
                return run_doc


def main():
    parser = argparse.ArgumentParser(description="Run scraper and persist to MongoDB")
    parser.add_argument("--config", default="config.ini", help="Path to config.ini")
    parser.add_argument("--max", type=int, default=100, help="Max results to fetch")
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
