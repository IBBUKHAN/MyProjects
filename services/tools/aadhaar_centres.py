"""Aadhaar centre lookup via Bhuvan PIN-code endpoint (lat/lon map pins)."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

import httpx
from bs4 import BeautifulSoup
from langchain_core.tools import tool

BHUVAN_PIN_URL = (
    "https://bhuvan.nrsc.gov.in/aadhaar/"
    "usrtask/app_specific/get/getpinDetails.php"
)
BHUVAN_PORTAL = "https://bhuvan.nrsc.gov.in/aadhaar/"
_PIN_RE = re.compile(r"^\d{6}$")
_MARKER_RE = re.compile(r"addmarker\(([-\d.]+),([-\d.]+)\)")


def _maps_url(lat: float, lon: float) -> str:
    return f"https://www.google.com/maps?q={lat},{lon}"


def fetch_centres_by_pincode(pincode: str, limit: int = 5) -> Dict[str, Any]:
    pin = (pincode or "").strip()
    if not _PIN_RE.fullmatch(pin):
        return {
            "success": False,
            "error": "Invalid PIN code. Provide a valid 6-digit Indian PIN code.",
            "pincode": pin,
            "centres": [],
        }

    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            resp = client.get(BHUVAN_PIN_URL, params={"sno": pin, "str": ""})
            resp.raise_for_status()
            payload = resp.json()
    except Exception as e:
        return {
            "success": False,
            "error": f"Could not reach Bhuvan Aadhaar centre service: {e}",
            "pincode": pin,
            "centres": [],
            "portal": BHUVAN_PORTAL,
        }

    html = payload.get("centerData") or ""
    soup = BeautifulSoup(html, "html.parser")
    centres: List[Dict[str, Any]] = []

    for tr in soup.find_all("tr"):
        name_el = tr.find(class_="vCenterName")
        addr_el = tr.find(class_="vCenterAdd")
        if not name_el:
            continue
        marker = _MARKER_RE.search(str(tr))
        if not marker:
            continue
        lat = float(marker.group(1))
        lon = float(marker.group(2))
        centres.append(
            {
                "name": name_el.get_text(strip=True),
                "address": addr_el.get_text(" ", strip=True) if addr_el else "",
                "latitude": lat,
                "longitude": lon,
                "map_pin": _maps_url(lat, lon),
            }
        )
        if len(centres) >= limit:
            break

    return {
        "success": True,
        "pincode": pin,
        "count": len(centres),
        "centres": centres,
        "portal": BHUVAN_PORTAL,
        "note": "Locations from official Bhuvan Aadhaar Centres map.",
    }


@tool
def find_aadhaar_centres_by_pincode(pincode: str) -> str:
    """Find nearby Aadhaar enrolment / Seva Kendras for a 6-digit Indian PIN code.

    Use this when the user wants nearby Aadhaar centres and has provided a PIN code.
    Returns centre names, addresses, lat/lon, and Google Maps pin links.
    Do NOT call this tool until you have a valid 6-digit PIN code.
    """
    result = fetch_centres_by_pincode(pincode)
    return json.dumps(result, ensure_ascii=False)
