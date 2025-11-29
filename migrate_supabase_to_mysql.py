"""
Migration script: Export data from Supabase and import to MySQL

This script:
1. Connects to Supabase and fetches all data from ads and runs tables
2. Connects to local MySQL database
3. Imports all data preserving structure and timestamps
4. Reports progress and statistics

Usage:
    python migrate_supabase_to_mysql.py --config config.ini
"""
import argparse
import configparser
import json
import sys
from typing import Dict, Any

try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("❌ Error: supabase package not installed. Run: pip install supabase")
    sys.exit(1)

try:
    from db_mysql import MySQLClient
    MYSQL_AVAILABLE = True
except ImportError:
    print("❌ Error: mysql-connector-python not installed. Run: pip install mysql-connector-python")
    sys.exit(1)


def load_config(path: str) -> Dict[str, Dict[str, Any]]:
    """Load configuration from ini file."""
    cfg = configparser.ConfigParser()
    cfg.read(path)
    out: Dict[str, Dict[str, Any]] = {"supabase": {}, "mysql": {}}
    
    if cfg.has_section("supabase"):
        out["supabase"] = dict(cfg.items("supabase"))
    
    if cfg.has_section("mysql"):
        out["mysql"] = dict(cfg.items("mysql"))
    
    return out


def get_source_type(ad: Dict[str, Any]) -> str:
    """Determine if ad is from LBC or mobilede based on unique_key or URL."""
    unique_key = ad.get("unique_key", "")
    url = ad.get("url", "")
    
    if unique_key.startswith("mobilede:") or "automobile.fr" in url or "mobile.de" in url:
        return "mobilede"
    else:
        return "lbc"


def clean_row_for_mysql(row: Dict[str, Any]) -> Dict[str, Any]:
    """Clean and prepare row data for MySQL insertion."""
    cleaned = {}
    for key, value in row.items():
        if value is None:
            cleaned[key] = None
        elif isinstance(value, (dict, list)):
            # Convert JSON objects to strings
            cleaned[key] = json.dumps(value) if value else None
        elif isinstance(value, bool):
            cleaned[key] = value
        elif value == 'true':
            # Convert string 'true' to boolean 1 for MySQL
            cleaned[key] = 1
        elif value == 'false':
            # Convert string 'false' to boolean 0 for MySQL
            cleaned[key] = 0
        else:
            cleaned[key] = value
    return cleaned


def migrate_data(config_path: str, batch_size: int = 100, dry_run: bool = False):
    """Main migration function."""
    print("🚀 Starting Supabase → MySQL Migration")
    print("=" * 60)
    
    # Load config
    cfg = load_config(config_path)
    sb_cfg = cfg.get("supabase", {})
    mysql_cfg = cfg.get("mysql", {})
    
    if not sb_cfg.get("url") or not sb_cfg.get("key"):
        print("❌ Error: Supabase configuration missing in config.ini")
        print("   Required: [supabase] section with 'url' and 'key'")
        sys.exit(1)
    
    if not mysql_cfg.get("host"):
        print("❌ Error: MySQL configuration missing in config.ini")
        print("   Required: [mysql] section with connection details")
        sys.exit(1)
    
    # Connect to Supabase
    print("\n📡 Connecting to Supabase...")
    try:
        supa = create_client(sb_cfg["url"], sb_cfg["key"])
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Connect to MySQL
    print("\n🗄️  Connecting to MySQL...")
    try:
        mysql = MySQLClient(
            host=mysql_cfg.get("host", "localhost"),
            port=int(mysql_cfg.get("port", 3307)),
            user=mysql_cfg.get("user", "collector"),
            password=mysql_cfg.get("password", "collectorpass"),
            database=mysql_cfg.get("database", "cars_collector")
        )
        print("✅ Connected to MySQL")
    except Exception as e:
        print(f"❌ Failed to connect to MySQL: {e}")
        print("   Make sure Docker is running: docker-compose up -d")
        sys.exit(1)
    
    # Verify/create tables from schema
    print("\n🔧 Checking MySQL tables...")
    try:
        import subprocess
        result = subprocess.run(
            ["docker-compose", "exec", "-T", "mysql", "mysql", "-u", "collector", "-pcollectorpass", "cars_collector"],
            input=open("mysql_schema.sql", "rb").read(),
            capture_output=True,
            timeout=30
        )
        if result.returncode == 0:
            print("✅ Schema applied successfully")
        else:
            print(f"⚠️  Schema application had warnings (this is OK if tables already exist)")
    except Exception as e:
        print(f"⚠️  Could not auto-apply schema: {e}")
        print("   Tables may already exist, continuing...")
    
    # Get Supabase table names (source) - use actual Supabase table names
    source_lbc_table = sb_cfg.get("lbc_table", "ads_lbc")
    source_mobilede_table = sb_cfg.get("mobilede_table", "ads_mobilede")
    source_runs_table = sb_cfg.get("runs_table", "runs")
    
    # Get MySQL table names (target)
    target_lbc_table = mysql_cfg.get("lbc_table", "ads_lbc")
    target_mobilede_table = mysql_cfg.get("mobilede_table", "ads_mobilede")
    target_runs_table = mysql_cfg.get("runs_table", "runs")
    
    stats = {
        "lbc_total": 0,
        "lbc_inserted": 0,
        "mobilede_total": 0,
        "mobilede_inserted": 0,
        "runs_total": 0,
        "runs_inserted": 0,
        "errors": []
    }
    
    # ========== MIGRATE ADS ==========
    print(f"\n📦 Fetching ads from Supabase...")
    
    lbc_ads = []
    mobilede_ads = []
    
    # Fetch LBC ads
    try:
        print(f"   Fetching from table: {source_lbc_table}")
        offset = 0
        while True:
            print(f"      Batch at offset {offset}...")
            result = supa.table(source_lbc_table).select("*").range(offset, offset + 999).execute()
            ads_batch = result.data or []
            
            if not ads_batch:
                break
            
            lbc_ads.extend(ads_batch)
            offset += len(ads_batch)
            
            if len(ads_batch) < 1000:
                break
        
        print(f"   ✅ Fetched {len(lbc_ads)} LBC ads")
    except Exception as e:
        print(f"   ⚠️  Error fetching LBC ads: {e}")
        stats["errors"].append(f"LBC fetch error: {e}")
    
    # Fetch Mobile.de ads
    try:
        print(f"   Fetching from table: {source_mobilede_table}")
        offset = 0
        while True:
            print(f"      Batch at offset {offset}...")
            result = supa.table(source_mobilede_table).select("*").range(offset, offset + 999).execute()
            ads_batch = result.data or []
            
            if not ads_batch:
                break
            
            mobilede_ads.extend(ads_batch)
            offset += len(ads_batch)
            
            if len(ads_batch) < 1000:
                break
        
        print(f"   ✅ Fetched {len(mobilede_ads)} Mobile.de ads")
    except Exception as e:
        print(f"   ⚠️  Error fetching Mobile.de ads: {e}")
        stats["errors"].append(f"Mobile.de fetch error: {e}")
    
    stats["lbc_total"] = len(lbc_ads)
    stats["mobilede_total"] = len(mobilede_ads)
        
    stats["lbc_total"] = len(lbc_ads)
    stats["mobilede_total"] = len(mobilede_ads)
    
    print(f"\n📊 Distribution:")
    print(f"   LBC ads:      {len(lbc_ads)}")
    print(f"   Mobile.de:    {len(mobilede_ads)}")
    
    if dry_run:
        print("\n🔍 DRY RUN: Skipping actual insertion")
    else:
        # Insert LBC ads
        if lbc_ads:
            print(f"\n💾 Inserting {len(lbc_ads)} LBC ads into {target_lbc_table}...")
            for i in range(0, len(lbc_ads), batch_size):
                batch = lbc_ads[i:i + batch_size]
                cleaned_batch = [clean_row_for_mysql(ad) for ad in batch]
                try:
                    mysql.table(target_lbc_table).upsert(cleaned_batch, on_conflict="unique_key")
                    stats["lbc_inserted"] += len(batch)
                    print(f"   ✓ Inserted batch {i//batch_size + 1} ({len(batch)} records)")
                except Exception as e:
                    error_msg = f"Error inserting LBC batch at offset {i}: {e}"
                    print(f"   ❌ {error_msg}")
                    stats["errors"].append(error_msg)
            
            print(f"✅ Inserted {stats['lbc_inserted']}/{stats['lbc_total']} LBC ads")
        
        # Insert Mobile.de ads
        if mobilede_ads:
            print(f"\n💾 Inserting {len(mobilede_ads)} Mobile.de ads into {target_mobilede_table}...")
            for i in range(0, len(mobilede_ads), batch_size):
                batch = mobilede_ads[i:i + batch_size]
                cleaned_batch = [clean_row_for_mysql(ad) for ad in batch]
                try:
                    mysql.table(target_mobilede_table).upsert(cleaned_batch, on_conflict="unique_key")
                    stats["mobilede_inserted"] += len(batch)
                    print(f"   ✓ Inserted batch {i//batch_size + 1} ({len(batch)} records)")
                except Exception as e:
                    error_msg = f"Error inserting Mobile.de batch at offset {i}: {e}"
                    print(f"   ❌ {error_msg}")
                    stats["errors"].append(error_msg)
            
            print(f"✅ Inserted {stats['mobilede_inserted']}/{stats['mobilede_total']} Mobile.de ads")
    
    # ========== MIGRATE RUNS ==========
    print(f"\n📦 Fetching runs from Supabase table: {source_runs_table}")
    
    try:
        offset = 0
        all_runs = []
        
        while True:
            print(f"   Fetching batch at offset {offset}...")
            result = supa.table(source_runs_table).select("*").range(offset, offset + 999).execute()
            runs_batch = result.data or []
            
            if not runs_batch:
                break
            
            all_runs.extend(runs_batch)
            offset += len(runs_batch)
            
            if len(runs_batch) < 1000:
                break
        
        stats["runs_total"] = len(all_runs)
        print(f"✅ Fetched {len(all_runs)} runs from Supabase")
        
        if not dry_run and all_runs:
            print(f"\n💾 Inserting {len(all_runs)} runs into {target_runs_table}...")
            for i in range(0, len(all_runs), batch_size):
                batch = all_runs[i:i + batch_size]
                cleaned_batch = [clean_row_for_mysql(run) for run in batch]
                try:
                    mysql.table(target_runs_table).insert(cleaned_batch)
                    stats["runs_inserted"] += len(batch)
                    print(f"   ✓ Inserted batch {i//batch_size + 1} ({len(batch)} records)")
                except Exception as e:
                    error_msg = f"Error inserting runs batch at offset {i}: {e}"
                    print(f"   ❌ {error_msg}")
                    stats["errors"].append(error_msg)
            
            print(f"✅ Inserted {stats['runs_inserted']}/{stats['runs_total']} runs")
    
    except Exception as e:
        print(f"❌ Error during runs migration: {e}")
        stats["errors"].append(f"Runs migration error: {e}")
    
    # ========== SUMMARY ==========
    print("\n" + "=" * 60)
    print("📊 MIGRATION SUMMARY")
    print("=" * 60)
    print(f"LBC Ads:       {stats['lbc_inserted']:,} / {stats['lbc_total']:,} migrated")
    print(f"Mobile.de Ads: {stats['mobilede_inserted']:,} / {stats['mobilede_total']:,} migrated")
    print(f"Runs:          {stats['runs_inserted']:,} / {stats['runs_total']:,} migrated")
    print(f"Errors:        {len(stats['errors'])}")
    
    if stats["errors"]:
        print("\n⚠️  Errors encountered:")
        for error in stats["errors"][:10]:  # Show first 10 errors
            print(f"   - {error}")
        if len(stats["errors"]) > 10:
            print(f"   ... and {len(stats['errors']) - 10} more")
    
    total_migrated = stats['lbc_inserted'] + stats['mobilede_inserted'] + stats['runs_inserted']
    total_expected = stats['lbc_total'] + stats['mobilede_total'] + stats['runs_total']
    
    if total_migrated == total_expected:
        print("\n✅ Migration completed successfully!")
    else:
        print(f"\n⚠️  Migration completed with some issues ({total_migrated}/{total_expected} records)")
    
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Migrate data from Supabase to MySQL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Normal migration
  python migrate_supabase_to_mysql.py --config config.ini
  
  # Dry run (preview without inserting)
  python migrate_supabase_to_mysql.py --config config.ini --dry-run
  
  # Custom batch size
  python migrate_supabase_to_mysql.py --config config.ini --batch-size 50
        """
    )
    parser.add_argument(
        "--config",
        default="config.ini",
        help="Path to config.ini file (default: config.ini)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of records to insert per batch (default: 100)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview migration without actually inserting data"
    )
    
    args = parser.parse_args()
    
    migrate_data(args.config, args.batch_size, args.dry_run)


if __name__ == "__main__":
    main()
