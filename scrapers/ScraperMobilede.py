from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set

try:
    from curl_cffi import requests
except Exception:
    raise ImportError("curl_cffi is required. Install with 'pip install curl-cffi'")

try:
    from bs4 import BeautifulSoup
except Exception:
    raise ImportError("beautifulsoup4 is required. Install with 'pip install beautifulsoup4'")


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class ScraperMobilede:
    """Scraper for automobile.fr (mobile.de France) listing pages.

    It paginates using the `pgn` URL parameter until:
      - a page returns no <article.list-entry> elements, or
      - an already known id is encountered (if stop_on_known=True and existing_ids provided), or
      - max_results is reached.

    The parsed ad dicts are shaped to match the LBC mapper in run_collector.map_ad_to_row as much as possible.
    """

    BASE_URL = (
        "https://www.mobile.de/fr/voiture/recherche.html?vc=Car&sb=doc&od=down&pageNumber={pgn}"
    )

    def __init__(
        self,
        start_page: int = 1,
        page_size: int = 50,
        max_results: int = 1100,
        headers: Optional[Dict[str, str]] = None,
        cookies: Optional[Dict[str, str]] = None,
        timeout: int = 30,
        impersonate: Optional[str] = None,
        use_session: bool = True,
        existing_ids: Optional[Set[str]] = None,
        stop_on_known: bool = False,
        base_url_template: Optional[str] = None,
    ) -> None:
        self.start_page = max(1, int(start_page))
        self.page_size = max(1, int(page_size))
        self.max_results = int(max_results or 0)
        self.timeout = timeout
        self.impersonate = impersonate or "safari_ios"
        self._existing_ids = set(existing_ids) if existing_ids else None
        self._stop_on_known = bool(stop_on_known)
        self.base_url_template = base_url_template or self.BASE_URL

        default_headers = {
            ":authority": "www.mobile.de",
            ":method": "GET",
            ":path": "/fr/voiture/recherche.html?isSearchRequest=true&ref=quickSearch&s=Car&vc=Car",
            ":scheme": "https",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "max-age=0",
            "priority": "u=0, i",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "user-agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/140.0.0.0 Safari/537.36"
            ),
        }
        self.headers: Dict[str, str] = default_headers
        if headers:
            self.headers.update(headers)
        self.cookies: Dict[str, str] = cookies.copy() if cookies else {}

        self._session: Optional[requests.Session] = None
        if use_session:
            self._session = requests.Session()
            self._session.headers.update(self.headers)
            if self.cookies:
                try:
                    self._session.cookies.update(self.cookies)
                except Exception:
                    pass

        self._results: List[Dict[str, Any]] = []

    # ------------------------ HTTP helpers ------------------------
    def _fetch_page(self, page: int) -> str:
        url = self.base_url_template.format(pgn=page)
        if self._session is not None:
            resp = self._session.get(url, timeout=self.timeout, impersonate=self.impersonate)
        else:
            resp = requests.get(url, timeout=self.timeout, impersonate=self.impersonate, headers=self.headers, cookies=self.cookies)
        resp.raise_for_status()
        return resp.text

    # ------------------------ parsing helpers ------------------------
    @staticmethod
    def _text(el) -> str:
        return (el.get_text(" ", strip=True) if el else "").strip()

    @staticmethod
    def _num(s: Optional[str]) -> Optional[float]:
        if not s:
            return None
        # normalize nb spaces like 13 990 €
        s2 = re.sub(r"[\s\u202f\u00a0]", "", s)  # remove spaces incl. NBSP, NARROW NBSP
        s2 = s2.replace("€", "").replace(",", ".")
        m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s2)
        if not m:
            return None
        try:
            return float(m.group(1))
        except Exception:
            return None

    @staticmethod
    def _parse_reg_km(s: str) -> tuple[Optional[str], Optional[int]]:
        # Example: "12/2017, 66 438 km"
        reg = None
        km = None
        if not s:
            return None, None
        parts = [p.strip() for p in s.split(",")]
        if parts:
            # reg as MM/YYYY -> normalize YYYY-MM
            m = re.match(r"(\d{2})/(\d{4})", parts[0])
            if m:
                reg = f"{m.group(2)}-{m.group(1)}"
        if len(parts) > 1:
            km_s = re.sub(r"[^0-9]", "", parts[1])
            if km_s:
                try:
                    km = int(km_s)
                except Exception:
                    km = None
        return reg, km

    @staticmethod
    def _parse_power(s: str) -> tuple[Optional[int], Optional[int]]:
        # Example: "81 kW (110 Ch DIN)"
        if not s:
            return None, None
        kw = None
        ch = None
        mkw = re.search(r"(\d{2,3})\s*kW", s)
        mch = re.search(r"(\d{2,3})\s*Ch", s)
        if mkw:
            try:
                kw = int(mkw.group(1))
            except Exception:
                pass
        if mch:
            try:
                ch = int(mch.group(1))
            except Exception:
                pass
        return kw, ch

    @staticmethod
    def _parse_specs_line(s: str) -> Dict[str, Any]:
        # Example: "Break, Essence, Boîte manuelle"
        out: Dict[str, Any] = {}
        if not s:
            return out
        items = [it.strip() for it in s.split(",")]
        for it in items:
            low = it.lower()
            # vehicle type (Break, Berline, SUV...)
            if low in {"break", "berline", "suv", "monospace", "cabriolet", "coupé", "pick-up", "utilitaire"}:
                out["vehicle_type"] = it
            elif "boîte" in low or "boite" in low or "manuel" in low or "auto" in low:
                out["gearbox"] = it
            elif any(k in low for k in ["essence", "diesel", "hybride", "electrique", "électrique", "gpl"]):
                out["fuel"] = it
        return out

    @staticmethod
    def _parse_color_doors(s: str) -> Dict[str, Any]:
        # Example: "Couleur extérieure: Blanc, Nombre de portes: 4/5"
        out: Dict[str, Any] = {}
        if not s:
            return out
        # color
        m = re.search(r"Couleur\s+extérieure\s*:\s*([^,]+)", s, re.IGNORECASE)
        if m:
            out["vehicule_color"] = m.group(1).strip()
        # doors
        m2 = re.search(r"Nombre\s+de\s+portes\s*:\s*([0-9]+)", s, re.IGNORECASE)
        if m2:
            try:
                out["doors"] = int(m2.group(1))
            except Exception:
                pass
        return out

    @staticmethod
    def _make_attr(key: str, value: Any, value_label: Optional[str] = None) -> Dict[str, Any]:
        return {"key": key, "value": value, "value_label": value_label or (str(value) if value is not None else None)}

    @staticmethod
    def _abs_url(href: str) -> str:
        if not href:
            return href
        if href.startswith("http"):
            return href
        return "https://www.automobile.fr" + href

    def _parse_article(self, art) -> Optional[Dict[str, Any]]:
        # Detect new layout vs old layout
        is_new_layout = art.select_one("a[class*='BaseListing']")
        
        if is_new_layout:
            return self._parse_article_new_layout(art)
        else:
            return self._parse_article_old_layout(art)
    
    def _parse_article_old_layout(self, art) -> Optional[Dict[str, Any]]:
        """Parse article with old layout (vehicle-data, vehicle-information classes)"""
        # id and url
        a = art.select_one("a.vehicle-data") or art.find("a", attrs={"data-vehicle-id": True})
        if not a:
            return None
        vid = a.get("data-vehicle-id") or a.get("data-track-dimension")
        if not vid:
            # try nested button
            btn = art.find(attrs={"data-vehicle-id": True})
            if btn:
                vid = btn.get("data-vehicle-id")
        if not vid:
            return None
        try:
            list_id = int(str(vid))
        except Exception:
            list_id = None

        url = self._abs_url(a.get("href"))
        # subject/title
        title_el = art.select_one("h3.vehicle-title")
        subject = self._text(title_el)
        # price
        price_el = art.select_one(".vehicle-prices .seller-currency")
        price = self._num(self._text(price_el))
        # regdate & mileage
        info_primary = art.select_one(".vehicle-information p.u-text-bold")
        reg, km = self._parse_reg_km(self._text(info_primary))
        # power line
        power_el = art.select(".vehicle-information p.u-text-grey-60")
        kw = None
        ch = None
        if power_el:
            kw, ch = self._parse_power(self._text(power_el[0]))
        # specs (vehicle type, fuel, gearbox)
        specs_el = art.select_one(".vehicle-techspecs p.u-text-grey-60")
        specs = self._parse_specs_line(self._text(specs_el))
        # color/doors line (often the next p)
        color_doors_el = None
        p_list = art.select(".vehicle-techspecs p.u-text-grey-60")
        if len(p_list) >= 2:
            color_doors_el = p_list[1]
        color_doors = self._parse_color_doors(self._text(color_doors_el) if color_doors_el else "")
        # image
        img_el = art.select_one(".thumbnail img")
        img_url = img_el.get("src") if img_el else None
        # location text block
        loc_block = art.select_one(".g-row > .u-text-grey-60")
        city = None
        zipcode = None
        if loc_block:
            txt = self._text(loc_block)
            # leading zipcode pattern
            m = re.search(r"\b(\d{4,5})\b", txt)
            if m:
                zipcode = m.group(1)
            # city - naive: after zipcode until comma
            if zipcode and zipcode in txt:
                after = txt.split(zipcode, 1)[1].strip(", ")
                city = after.split(",")[0].strip() if after else None

        # brand and model from subject (best-effort: split first 2 tokens)
        car_brand = None
        car_model = None
        if subject:
            parts = subject.split()
            if parts:
                car_brand = parts[0]
                if len(parts) > 1:
                    car_model = parts[1]

        return self._build_ad_dict(
            list_id=list_id,
            url=url,
            subject=subject,
            price=price,
            reg=reg,
            km=km,
            kw=kw,
            ch=ch,
            specs=specs,
            color_doors=color_doors,
            img_url=img_url,
            city=city,
            zipcode=zipcode,
            car_brand=car_brand,
            car_model=car_model
        )
    
    def _parse_article_new_layout(self, art) -> Optional[Dict[str, Any]]:
        """Parse article with new layout (robust selectors, class-hash independent)"""

        # --- LINK / URL ---
        a = art.select_one(
            "a[class*='BaseListing']"
        )
        if not a:
            logging.info("URL not found for item")
            return None

        url = self._abs_url(a.get("href", ""))
        # Extract vehicle ID
        list_id = None
        if url:
            m = re.search(r"[?&]id=(\d+)\b", url)
            if m:
                try:
                    list_id = int(m.group(1))
                except Exception:
                    list_id = None

        # If no numeric id found, generate a UUID so the ad still has a unique identifier
        if list_id is None:
            uid = str(__import__("uuid").uuid4())
            list_id = uid

        # --- TITLE ---
        title_el = art.select_one(
            "h2[class*='ListingTitle'], "
            "h2[data-testid='title'], "
            "h2[class*='title'], "
            "h2"
        )
        subject = self._text(title_el)
        if subject:
            # Remove common badge text (NOUVEAU, Sponsorisée, etc.)
            subject = re.sub(r"^(NOUVEAU|Sponsorisée)\s*", "", subject, flags=re.IGNORECASE).strip()

        # --- PRICE ---
        price_el = art.select_one(
            "span[class*='PriceLabel'], "
            "span[data-testid='price-label'], "
            "div[data-testid='price'] span, "
            "span[class*='price']"
        )
        price = self._num(self._text(price_el))

        # --- DETAILS (date, km, power, fuel) ---
        details_el = art.select_one(
            "div[data-testid='listing-details-attributes'], "
            "ul[data-testid='vehicle-features'], "
            "div[class*='attributes'], "
            "div[class*='vehicleDetails']"
        )
        details_text = self._text(details_el)

        reg = km = kw = ch = fuel = None

        if details_text:
            # Split on any bullet or separator
            parts = [p.strip() for p in re.split(r"[•|·|●|∙]", details_text) if p.strip()]
            for part in parts:
                # Registration date (PI 08/2018)
                m_reg = re.search(r"PI\s+(\d{2})/(\d{4})", part)
                if m_reg:
                    reg = f"{m_reg.group(2)}-{m_reg.group(1)}"

                # Mileage (107 389 km)
                m_km = re.search(r"([\d\s\u202f\u00a0]+)\s*km", part)
                if m_km:
                    km_str = re.sub(r"[\s\u202f\u00a0]", "", m_km.group(1))
                    try:
                        km = int(km_str)
                    except Exception:
                        pass

                # Power (200 kW (272 Ch DIN))
                kw_match, ch_match = self._parse_power(part)
                if kw_match:
                    kw = kw_match
                if ch_match:
                    ch = ch_match

                # Fuel
                part_lower = part.lower()
                if "hybride" in part_lower:
                    fuel = part.strip()
                elif any(k in part_lower for k in ["diesel", "essence", "petrol", "electric", "électrique", "gpl"]):
                    fuel = part.strip()

        # --- SELLER INFO ---
        seller_el = art.select_one(
            "div[class*='SellerInfo'], "
            "div[data-testid='seller-info'], "
            "div[class*='dealer'], "
            "div[class*='seller']"
        )
        city = zipcode = None
        if seller_el:
            seller_text = self._text(seller_el)
            m = re.search(r"([A-Z]{2})-(\d{4,5})\s+([^(]+)", seller_text)
            if m:
                zipcode = m.group(2)
                city = m.group(3).strip()

        # --- IMAGES ---
        img_urls = []

        main_img = art.select_one(
            "img[class*='PreviewImage'], "
            "img[data-testid='main-image'], "
            "img[class*='mainImage'], "
            "img"
        )
        if main_img:
            img_url = main_img.get("src") or (
                main_img.get("srcset", "").split()[0] if main_img.get("srcset") else None
            )
            if img_url:
                img_urls.append(img_url)

        for thumb in art.select(
            "img[class*='Thumbnail'], img[data-testid*='thumbnail'], img[class*='thumb']"
        ):
            thumb_url = thumb.get("src")
            if thumb_url and thumb_url not in img_urls:
                img_urls.append(thumb_url)

        img_url = img_urls[0] if img_urls else None

        # --- BRAND & MODEL ---
        car_brand = car_model = None
        if subject:
            parts = subject.split()
            if parts:
                car_brand = parts[0]
                if len(parts) > 1:
                    car_model = parts[1]

        # --- SPECS DICT ---
        specs = {}
        if fuel:
            specs["fuel"] = fuel

        color_doors = {}

        # --- BUILD FINAL AD DICT ---
        return self._build_ad_dict(
            list_id=list_id,
            url=url,
            subject=subject,
            price=price,
            reg=reg,
            km=km,
            kw=kw,
            ch=ch,
            specs=specs,
            color_doors=color_doors,
            img_url=img_url,
            city=city,
            zipcode=zipcode,
            car_brand=car_brand,
            car_model=car_model,
            img_urls=img_urls if len(img_urls) > 1 else None
        )

    def _build_ad_dict(
        self,
        list_id: Optional[int],
        url: str,
        subject: str,
        price: Optional[float],
        reg: Optional[str],
        km: Optional[int],
        kw: Optional[int],
        ch: Optional[int],
        specs: Dict[str, Any],
        color_doors: Dict[str, Any],
        img_url: Optional[str],
        city: Optional[str],
        zipcode: Optional[str],
        car_brand: Optional[str],
        car_model: Optional[str],
        img_urls: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Build the final ad dictionary from parsed components"""
        
        """Build the final ad dictionary from parsed components"""
        
        attrs: List[Dict[str, Any]] = []
        def add_attr(key: str, value: Any, value_label: Optional[str] = None):
            if value is None or value == "":
                return
            attrs.append(self._make_attr(key, value, value_label))

        add_attr("brand", car_brand)
        add_attr("model", car_model)
        add_attr("regdate", reg)
        add_attr("mileage", km)
        if "fuel" in specs:
            add_attr("fuel", specs["fuel"]) 
        if "gearbox" in specs:
            add_attr("gearbox", specs["gearbox"]) 
        if "vehicle_type" in specs:
            add_attr("vehicle_type", specs["vehicle_type"]) 
        if "vehicule_color" in color_doors:
            add_attr("vehicule_color", color_doors["vehicule_color"]) 
        if "doors" in color_doors:
            add_attr("doors", color_doors["doors"]) 
        if ch is not None:
            add_attr("horse_power_din", ch)
        
        # images shape expected by mapper
        if img_urls:
            images = {
                "nb_images": len(img_urls),
                "thumb_url": img_urls[0] if img_urls else None,
                "small_url": img_urls[0] if img_urls else None,
                "urls": img_urls,
                "urls_thumb": img_urls,
                "urls_large": None,
            }
        else:
            images = {
                "nb_images": None,
                "thumb_url": img_url,
                "small_url": img_url,
                "urls": [img_url] if img_url else None,
                "urls_thumb": [img_url] if img_url else None,
                "urls_large": None,
            }

        # build final ad dict compatible with map_ad_to_row
        # Use a format parseable by run_collector._parse_dt (no microseconds)
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S%z")
        ad: Dict[str, Any] = {
            "source": "mobilede",
            "id": str(list_id) if list_id is not None else None,
            "list_id": list_id,
            "url": url,
            "subject": subject,
            "body": None,
            "category_id": "cars",
            "category_name": "Voitures",
            "ad_type": "offer",
            "status": "active",
            # price expected as list where first can be cast to float in mapper
            "price": [price] if price is not None else None,
            "price_cents": None,
            # dates (no publication date on listing page)
            "first_publication_date": None,
            "expiration_date": None,
            "index_date": now_iso,
            # images, location, owner, attributes
            "images": images,
            "location": {
                "country_id": "FR",
                "region_id": None,
                "region_name": None,
                "department_id": None,
                "department_name": None,
                "city": city,
                "city_label": city,
                "zipcode": zipcode,
                "lat": None,
                "lng": None,
            },
            "owner": {
                "store_id": None,
                "user_id": None,
                "type": None,
                "name": None,
            },
            "attributes": attrs,
        }

        
        return ad

    # ------------------------ public API ------------------------
    @staticmethod
    def deduplicate_rows(rows: Iterable[Dict[str, Any]], key_field: str = "id") -> List[Dict[str, Any]]:
        seen: Set[str] = set()
        out: List[Dict[str, Any]] = []

        for r in rows:
            # Try multiple possible key names in priority order
            k: Optional[Any] = (
                r.get(key_field)
                or r.get("list_id")
                or r.get("unique_key")
            )

            # Skip rows with no valid key
            if not k:
                continue

            k_str = str(k).strip()
            if not k_str or k_str in seen:
                continue

            seen.add(k_str)
            out.append(r)

        return out

    def scrape(self) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        page = self.start_page
        total_seen = 0

        while True:
            if self.max_results and len(results) >= self.max_results:
                break

            # fetch page with retry
            html = None
            for attempt in range(3):
                try:
                    html = self._fetch_page(page)
                    break
                except Exception as e:
                    logger.warning("Page fetch failed (pgn=%s, attempt %d): %s", page, attempt + 1, e)
                    if attempt < 2:
                        time.sleep(1 + 2 * attempt)
                        continue
                    html = "<html></html>"
            soup = BeautifulSoup(html, "html.parser")
            # Support both old and new layout article selectors
            articles = soup.select(
                'div[data-testid="result-list"] article, article.list-entry'
            )
            if not articles:
                logger.info("No articles on page %s; stopping.", page)
                break
            logger.info("Fetched page %s with %d articles.", page, len(articles))
            page_items: List[Dict[str, Any]] = []
            stop_due_known = False
            logger.info("Processing articles on page %s...", page)
            logger.info("Total seen so far: %d", len(articles))
            for art in articles:
                ad = self._parse_article(art)
                if not ad:
                    continue
                ad_key = ad.get("list_id")

                if self._stop_on_known and self._existing_ids is not None and ad_key is not None:
                    if str(ad_key) in self._existing_ids:
                        stop_due_known = True
                        break
                page_items.append(ad)

            results.extend(page_items)
            total_seen += len(articles)

            if stop_due_known:
                logger.info("Encountered a known id on page %s; stopping.", page)
                break

            if len(articles) == 0:
                break

            # advance page
            page += 1
            # be nice
            print("Going to next page %d got %d items, total %d" % (page, len(page_items), len(results)))
            print("Sleeping 3s...")
            time.sleep(3)

        # de-dup and trim
        results = self.deduplicate_rows(results, key_field="id")
        if self.max_results:
            results = results[: self.max_results]
        self._results = results
        return results

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._results, f, ensure_ascii=False, indent=2)

