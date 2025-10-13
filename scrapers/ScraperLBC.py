from __future__ import annotations

import json
import time
import logging
from typing import Any, Dict, List, Optional, Set
import configparser
from datetime import datetime, timezone

try:
    from curl_cffi import requests
except Exception:
    raise ImportError("curl_cffi is required. Install with 'pip install curl-cffi'")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class ScraperLBC:
    """Scraper for leboncoin finder/search endpoint.

    Constructor arguments:
      start_date: optional string to filter by date (not used directly by API but kept for caller)
      end_date: optional string
      max_results: int max number of ads to fetch
      params: dictionary of API parameters (will merge with defaults)
      ini_path: optional path to .ini config (overrides defaults)
      headers: optional headers dict override
    """

    BASE_URL = "https://api.leboncoin.fr/finder/search"

    def __init__(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        max_results: int = 1000,
        params: Optional[Dict[str, Any]] = None,
        ini_path: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: int = 30,
        cookies: Optional[Dict[str, str]] = None,
        impersonate: Optional[str] = None,
        use_session: bool = True,
        referer: Optional[str] = None,
        existing_ids: Optional[Set[str]] = None,
        stop_on_known: bool = False,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date
        self.max_results = int(max_results or 0)
        self.timeout = timeout
        # date limit support (stop pagination when reaching ads older than this)
        self.date_limit_str: Optional[str] = start_date
        self.date_limit_dt: Optional[datetime] = self._parse_dt(start_date) if start_date else None
        self.date_fields: List[str] = [
            "first_publication_date",
            "index_date",
            "publication_date",
        ]

        # defaults inferred from API.txt
        self.defaults = {
            "filters": {"category": {"id": "2"}, "enums": {"ad_type": ["offer"]}},
            "limit": 35,
            "limit_alu": 3,
            "sort_by": "relevance",
            "offset": 0,
            "disable_total": True,
            "extend": True,
            "listing_source": "pagination",
        }

        self.params = params.copy() if params else {}
        # merge defaults for missing keys
        for k, v in self.defaults.items():
            if k not in self.params:
                self.params[k] = v

        # base defaults
        default_headers = {
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/json",
            "user-agent": (
                # Chrome 131 on Windows as seen in API.txt
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            "api_key": "ba0c2dad52b3ec",
            "origin": "https://www.leboncoin.fr",
            "referer": referer or "https://www.leboncoin.fr/c/voitures",
            # Client hints and fetch metadata (make optional but default present)
            "sec-ch-ua": '"Google Chrome";v="131", "Not?A_Brand";v="8", "Chromium";v="131"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            # Additional headers observed
            "priority": "u=1, i",
        }

        self.headers: Dict[str, str] = default_headers
        if headers:
            self.headers.update(headers)

        # cookies and client config
        self.cookies: Dict[str, str] = cookies.copy() if cookies else {}
        self.impersonate = impersonate or "chrome131"  # configurable
        self.timeout = timeout

        # ini config overrides (params, headers, cookies, client)
        if ini_path:
            self._load_ini(ini_path)
            # _load_ini may have updated: self.params, self.headers, self.cookies, self.impersonate, self.timeout

        # internal state
        self._results: List[Dict[str, Any]] = []
        self._session: Optional[requests.Session] = None
        if use_session:
            self._session = requests.Session()
            # Some versions support setting default impersonate at request-time only; we'll pass per call.
            # Attach default headers and cookies to the session
            self._session.headers.update(self.headers)
            if self.cookies:
                try:
                    self._session.cookies.update(self.cookies)
                except Exception:
                    pass
        # duplicate stop config
        self._existing_ids = set(existing_ids) if existing_ids else None
        self._stop_on_known = bool(stop_on_known)

    def _load_ini(self, path: str) -> None:
        cfg = configparser.ConfigParser()
        cfg.read(path)
        if "api" in cfg:
            for key, val in cfg.items("api"):
                # try to parse JSON values for complex objects
                try:
                    parsed = json.loads(val)
                    self.params[key] = parsed
                except Exception:
                    # fallback to scalar
                    if val.lower() in ("true", "false"):
                        self.params[key] = cfg.getboolean("api", key)
                    else:
                        try:
                            ival = cfg.getint("api", key)
                            self.params[key] = ival
                        except Exception:
                            self.params[key] = val
        # Optional collector section: date_limit and date_fields
        if cfg.has_section("collector"):
            if cfg.has_option("collector", "date_limit"):
                self.date_limit_str = cfg.get("collector", "date_limit")
                self.date_limit_dt = self._parse_dt(self.date_limit_str)
            if cfg.has_option("collector", "date_fields"):
                raw = cfg.get("collector", "date_fields")
                try:
                    # allow JSON array
                    arr = json.loads(raw)
                    if isinstance(arr, list):
                        self.date_fields = [str(x) for x in arr if x]
                except Exception:
                    # allow comma-separated
                    self.date_fields = [s.strip() for s in raw.split(",") if s.strip()]

        # Optional headers section
        if cfg.has_section("headers"):
            for key, val in cfg.items("headers"):
                # don't JSON parse headers by default; accept raw string
                self.headers[key] = val

        # Optional cookies section (either key-value pairs or a single 'cookie' raw string)
        if cfg.has_section("cookies"):
            items = dict(cfg.items("cookies"))
            if "cookie" in items:
                # parse raw cookie header into dict
                raw = items.get("cookie", "")
                parsed = self._parse_cookie_string(raw)
                self.cookies.update(parsed)
                # also attach Cookie header if needed
                self.headers.setdefault("cookie", raw)
            else:
                # assume key=value pairs
                self.cookies.update(items)

        # Optional client section
        if cfg.has_section("client"):
            if cfg.has_option("client", "impersonate"):
                self.impersonate = cfg.get("client", "impersonate")
            if cfg.has_option("client", "timeout"):
                try:
                    self.timeout = cfg.getint("client", "timeout")
                except Exception:
                    pass

    def build_payload(self, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        payload = json.loads(json.dumps(self.params))  # deep copy
        payload["offset"] = offset
        if limit is not None:
            payload["limit"] = limit
        return payload

    def send_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send POST request and return parsed JSON response. Raises on network/parse errors."""
        body = json.dumps(payload)
        logger.debug("POST %s payload=%s", self.BASE_URL, body)
        # Prefer session if available
        if self._session is not None:
            resp = self._session.post(
                self.BASE_URL,
                data=body,
                headers=self.headers,  # allow per-request override
                timeout=self.timeout,
                impersonate=self.impersonate,
            )
        else:
            resp = requests.post(
                self.BASE_URL,
                data=body,
                headers=self.headers,
                timeout=self.timeout,
                impersonate=self.impersonate,
            )
        # raise for status
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception as e:
            raise ValueError(f"Failed to parse JSON response: {e}\nResponse text: {resp.text}")

    @staticmethod
    def _parse_dt(s: Optional[str]) -> Optional[datetime]:
        if not s:
            return None
        fmts = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S %z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
        ]
        for f in fmts:
            try:
                dt = datetime.strptime(s, f)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except Exception:
                continue
        return None

    def _extract_ad_datetime(self, ad: Dict[str, Any]) -> Optional[datetime]:
        for key in self.date_fields:
            if key in ad and ad[key]:
                dt = self._parse_dt(str(ad[key]))
                if dt:
                    return dt
        return None

    @staticmethod
    def _parse_cookie_string(cookie_header: str) -> Dict[str, str]:
        jar: Dict[str, str] = {}
        for part in cookie_header.split(";"):
            part = part.strip()
            if not part or "=" not in part:
                continue
            k, v = part.split("=", 1)
            jar[k.strip()] = v.strip()
        return jar

    @staticmethod
    def deduplicate_rows(rows: List[Dict[str, Any]], key_field: str = "id") -> List[Dict[str, Any]]:
        """Deduplicate rows by primary key 'id'. If 'id' is missing/empty, fallback to 'list_id'.

        Args:
            rows: list of ad dicts
            key_field: primary key field to prefer (default 'id')

        Returns:
            Unique list preserving first occurrence order.
        """
        seen = set()
        unique: List[Dict[str, Any]] = []
        for r in rows:
            k = r.get(key_field)
            if not k:
                # fallback
                k = r.get("list_id") or r.get("unique_key")
            if k and k not in seen:
                seen.add(k)
                unique.append(r)
        return unique

    def scrape(self) -> List[Dict[str, Any]]:
        """Main scraping loop. Paginates until max_results or no more items.

        Returns list of ad dicts.
        """
        collected: List[Dict[str, Any]] = []
        offset = int(self.params.get("offset", 0) or 0)
        limit = int(self.params.get("limit", 35) or 35)

        # if max_results smaller than page limit, request smaller chunks
        older_reached = False
        while True:
            
            if self.max_results and len(collected) >= self.max_results:
                break

            this_limit = min(limit, max(1, self.max_results - len(collected))) if self.max_results else limit
            payload = self.build_payload(offset=offset, limit=this_limit)

            # retry logic
            for attempt in range(3):
                try:
                    data = self.send_request(payload)
                    break
                except Exception as e:
                    logger.warning("Request failed (attempt %d): %s", attempt + 1, e)
                    if attempt < 2:
                        time.sleep(1 + attempt * 2)
                        continue
                    else:
                        raise

            # extract listings - the exact key may vary based on API. We'll try common keys.
            hits = []
            if isinstance(data, dict):
                # try 'ads' or 'results' or 'listings' or 'vacancies' or 'ads'
                for candidate in ("ads", "results", "listings", "announcements", "ads_v2"):
                    if candidate in data and isinstance(data[candidate], list):
                        hits = data[candidate]
                        break
                # fallback: if 'total' and 'ids_to_display' was in pivot, or if data contains 'ads' nested
                if not hits:
                    # find first list value in dict
                    for v in data.values():
                        if isinstance(v, list):
                            hits = v
                            break

            if not hits:
                logger.info("No more hits returned; stopping. Offset=%s", offset)
                break

            # Unified filter: enforce date_limit and stop_on_known during page scan
            page_kept: List[Dict[str, Any]] = []
            for ad in hits:
                # if configured, stop when a known id is reached
                if self._stop_on_known and self._existing_ids is not None:
                    # determine ad key
                    ad_key = ad.get("id") or ad.get("list_id") or ad.get("unique_key")
                    if ad_key is not None and str(ad_key) in self._existing_ids:
                        older_reached = True
                        break
                # enforce date cutoff if any
                if self.date_limit_dt is not None:
                    ad_dt = self._extract_ad_datetime(ad)
                    if ad_dt is None:
                        # can't evaluate: skip add but keep scanning in case newer items exist in page
                        continue
                    if ad_dt < self.date_limit_dt:
                        older_reached = True
                        break
                page_kept.append(ad)

            # add what we kept from this page
            collected.extend(page_kept)

            # advance offset
            offset += len(hits)

            # stop if fewer than requested were returned
            if len(hits) < this_limit or older_reached:
                break
            print("Sleeping 5s to be nice to server...\n got ", len(collected), " items so far.")
            time.sleep(5)  # be nice

    # de-duplicate by the API ad id (fallback to list_id if id missing)
        collected = self.deduplicate_rows(collected, key_field="id")

        # trim to max_results after de-duplication
        if self.max_results:
            collected = collected[: self.max_results]

        self._results = collected
        return collected

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._results, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    # quick demo when run directly (will not execute network call by default)
    print("ScraperLBC module. Use Test.py to run an example.")

    
    
    
