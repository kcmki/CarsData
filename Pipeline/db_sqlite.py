"""SQLite fallback for the collector.

Exposes the same API as db_mysql.MySQLClient (client.table(name).select()/insert()/upsert()...)
so run_collector.py and web_app.py work unchanged when the MySQL service is down.
Reuses db_mysql.TableQuery; a thin cursor wrapper translates the %s paramstyle to ?.
"""
import json
import sqlite3
from typing import Any, Dict, List

from db_mysql import TableQuery, QueryResult

# Same columns as mysql_schema.sql; SQLite is dynamically typed so JSON columns are TEXT.
_ADS_COLUMNS = """
  unique_key TEXT PRIMARY KEY, list_id INTEGER, url TEXT, subject TEXT, body TEXT,
  category_id TEXT, category_name TEXT, ad_type TEXT, status TEXT,
  price_cents INTEGER, price REAL,
  first_publication_date TEXT, expiration_date TEXT, index_date TEXT, has_phone INTEGER,
  images_nb INTEGER, images_thumb_url TEXT, images_small_url TEXT,
  images_urls TEXT, images_urls_thumb TEXT, images_urls_large TEXT,
  location_country_id TEXT, location_region_id TEXT, location_region_name TEXT,
  location_department_id TEXT, location_department_name TEXT, location_city TEXT,
  location_zipcode TEXT, location_lat REAL, location_lng REAL,
  owner_store_id TEXT, owner_user_id TEXT, owner_type TEXT, owner_name TEXT,
  car_brand TEXT, car_model TEXT, regdate TEXT, mileage INTEGER,
  fuel_label TEXT, gearbox_label TEXT, doors INTEGER, seats INTEGER,
  issuance_date TEXT, vehicle_type TEXT, vehicule_color TEXT, critair INTEGER,
  horsepower_fiscal INTEGER, horsepower_din INTEGER,
  raw TEXT, first_seen_at TEXT, updated_at TEXT
"""

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS ads_lbc ({_ADS_COLUMNS});
CREATE TABLE IF NOT EXISTS ads_mobilede ({_ADS_COLUMNS});
-- mobilede rows are upserted on list_id, which needs its own unique index
CREATE UNIQUE INDEX IF NOT EXISTS ux_ads_mobilede_list_id ON ads_mobilede(list_id);
CREATE INDEX IF NOT EXISTS idx_lbc_brand ON ads_lbc(car_brand);
CREATE INDEX IF NOT EXISTS idx_lbc_first_pub ON ads_lbc(first_publication_date);
CREATE INDEX IF NOT EXISTS idx_mobilede_brand ON ads_mobilede(car_brand);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, started_at TEXT, finished_at TEXT,
  attempts INTEGER, success INTEGER, count_scraped INTEGER, stats TEXT, error TEXT
);
"""


class _Cursor:
    """mysql-connector-ish cursor over sqlite3: %s params, optional dict rows."""

    def __init__(self, cursor: sqlite3.Cursor, dictionary: bool = False):
        self._cursor = cursor
        self._dict = dictionary

    def execute(self, sql: str, params=None):
        # SQL is built from literals + %s placeholders only, so a plain replace is safe
        return self._cursor.execute(sql.replace("%s", "?"), tuple(params or ()))

    def fetchone(self):
        row = self._cursor.fetchone()
        return dict(row) if (self._dict and row is not None) else row

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [dict(r) for r in rows] if self._dict else rows

    def close(self):
        self._cursor.close()


class _Connection:
    def __init__(self, path: str):
        self._conn = sqlite3.connect(path, timeout=30)

    def cursor(self, dictionary: bool = False):
        self._conn.row_factory = sqlite3.Row if dictionary else None
        return _Cursor(self._conn.cursor(), dictionary)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


class SQLiteTableQuery(TableQuery):
    def upsert(self, data: List[Dict[str, Any]], on_conflict: str):
        if not data:
            return QueryResult([])

        conn = self.client.get_connection()
        cursor = conn.cursor()
        try:
            for row in data:
                row = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in row.items()}
                cols = list(row.keys())
                placeholders = ",".join(["?"] * len(cols))
                updates = ",".join(f"{c}=excluded.{c}" for c in cols if c != on_conflict)
                cursor.execute(
                    f"INSERT INTO {self.table_name} ({','.join(cols)}) VALUES ({placeholders}) "
                    f"ON CONFLICT({on_conflict}) DO UPDATE SET {updates}",
                    [row[c] for c in cols],
                )
            conn.commit()
            return QueryResult([])
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()


class SQLiteClient:
    def __init__(self, path: str):
        self.path = path
        conn = sqlite3.connect(path)
        try:
            conn.executescript(SCHEMA)
            conn.commit()
        finally:
            conn.close()

    def get_connection(self):
        return _Connection(self.path)

    def table(self, table_name: str):
        return SQLiteTableQuery(self, table_name)


if __name__ == "__main__":
    import os
    import tempfile

    path = os.path.join(tempfile.mkdtemp(), "t.db")
    db = SQLiteClient(path)
    row = {"unique_key": "lbc:1", "subject": "Clio", "price": 5000.0,
           "raw": {"a": 1}, "first_seen_at": "t0", "updated_at": "t0"}
    db.table("ads_lbc").upsert([row], on_conflict="unique_key")
    db.table("ads_lbc").upsert([{**row, "price": 4000.0, "updated_at": "t1"}], on_conflict="unique_key")

    res = db.table("ads_lbc").select("*").in_("unique_key", ["lbc:1"]).execute()
    assert len(res.data) == 1, res.data
    got = res.data[0]
    assert got["price"] == 4000.0, got            # upsert updated
    assert got["first_seen_at"] == "t0", got      # and preserved first_seen_at
    assert got["raw"] == {"a": 1}, got            # JSON round-trip
    assert db.table("ads_lbc").select("*").eq("subject", "Clio").count() == 1

    db.table("runs").insert({"source": "LBC", "success": True, "stats": {"inserted": 1}})
    assert db.table("runs").select("*").execute().data[0]["source"] == "LBC"
    print("ok")
