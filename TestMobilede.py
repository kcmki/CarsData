"""
Quick test harness for ScraperMobilede.

Usage:
  python TestMobilede.py --max 20 --page-size 50
"""
import argparse
import json

from scrapers.ScraperMobilede import ScraperMobilede


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max", type=int, default=20)
    p.add_argument("--page", type=int, default=1)
    p.add_argument("--page-size", type=int, default=50)
    p.add_argument("--impersonate", default=None)
    p.add_argument("--nodup", action="store_true")
    args = p.parse_args()

    scraper = ScraperMobilede(
        start_page=args.page,
        page_size=args.page_size,
        max_results=args.max,
        impersonate=args.impersonate or "chrome131",
        stop_on_known=args.nodup,
    )
    ads = scraper.scrape()
    print(f"Fetched {len(ads)} items")
    if ads:
        print("Sample item:\n", json.dumps(ads[0], indent=2, ensure_ascii=False))
    scraper.save("output_mobilede.json")
    print("Saved results to output_mobilede.json")


if __name__ == "__main__":
    main()
