"""
Test harness for ScraperCars.

Usage examples:
  - Read config from `config.ini` (if present) and run:
      python Test.py
  - Or pass simple parameters via environment or modify the bottom of this file.

This script demonstrates instantiation and running of ScraperCars.
"""
import argparse
import json
import configparser
from ScraperCars import ScraperCars


def load_config(path: str):
    cfg = configparser.ConfigParser()
    cfg.read(path)
    data = {"api": {}, "headers": {}, "cookies": {}, "client": {}}
    if "api" in cfg:
        for k, v in cfg.items("api"):
            try:
                data["api"][k] = json.loads(v)
            except Exception:
                data["api"][k] = v
    if cfg.has_section("headers"):
        data["headers"] = dict(cfg.items("headers"))
    if cfg.has_section("cookies"):
        data["cookies"] = dict(cfg.items("cookies"))
    if cfg.has_section("client"):
        data["client"] = dict(cfg.items("client"))
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", help="Path to config.ini", default="config.ini")
    parser.add_argument("--max", type=int, help="Max results to fetch", default=10)
    parser.add_argument("--start", help="Start date (informational)")
    parser.add_argument("--end", help="End date (informational)")
    parser.add_argument("--impersonate", help="curl_cffi impersonate preset, e.g. chrome141")
    parser.add_argument("--referer", help="Referer header override")
    args = parser.parse_args()

    params = {}
    try:
        loaded = load_config(args.config)
    except Exception:
        loaded = {"api": {}, "headers": {}, "cookies": {}, "client": {}}

    # If config included complex JSON under keys like 'filters', ensure proper types
    client = loaded.get("client", {})
    impersonate = args.impersonate or client.get("impersonate")
    referer = args.referer

    scraper = ScraperCars(
        start_date=args.start,
        end_date=args.end,
        max_results=args.max,
        params=loaded.get("api", {}),
        headers=loaded.get("headers", {}),
        cookies=loaded.get("cookies", {}),
        impersonate=impersonate,
        referer=referer,
    )

    results = scraper.scrape()
    print(f"Fetched {len(results)} items")
    if results:
        print("Sample item:\n", json.dumps(results[0], indent=2, ensure_ascii=False))
    # Optionally save
    scraper.save("output.json")
    print("Saved results to output.json")


if __name__ == "__main__":
    main()
