#!/usr/bin/env python3
"""
Aranya Vihaara — Ticket Availability Watcher
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Uses direct HTTP requests — no browser clicking needed.
Pick trek by number, enter date, it runs in background.

Usage:  python watcher.py
"""
import re
import sys
import time
import requests
from datetime import datetime

BASE_URL         = "https://aranyavihaara.karnataka.gov.in"
DEFAULT_INTERVAL = 300   # 5 min

# ── WhatsApp via Peaky Assist (fill in when you share API docs) ──────────────
PEAKY_API_URL = ""
PEAKY_API_KEY = ""
WHATSAPP_TO   = "917795620385"

# ── Trek menu (district_id from site HTML) ────────────────────────────────────
# district IDs: Dakshina Kannada=24, Chikmagalur=17, Kodagu=25, Kolar=19,
#               Shivamogga=15, Udupi=16, Chikkaballapur=28, Ramanagara=29
#               Bengaluru Rural=21, Chamarajanagara=27, Kalaburagi=4
TREK_MENU = {
    1: {"label": "Nethravathi Trek",           "district_id": "24", "keyword": "nethravathi"},
    2: {"label": "Bandaje Falls Trek",          "district_id": "24", "keyword": "bandaje"},
    3: {"label": "Kudremukh Trek",              "district_id": "17", "keyword": "kudremukh"},
    4: {"label": "Brahmagiri Trek",             "district_id": "25", "keyword": "brahmagiri"},
    5: {"label": "Antharagange Cave Trek",      "district_id": "19", "keyword": "antharagange"},
    6: {"label": "Bisle Ghat Trek",             "district_id": "24", "keyword": "bisle"},
    7: {"label": "Ettina Bhuja Trek",           "district_id": "17", "keyword": "ettina"},
    8: {"label": "Kumara Parvatha Trek",        "district_id": "24", "keyword": "kumara"},
    9: {"label": "Talacauvery-Nishanimotte",   "district_id": "25", "keyword": "talacauvery"},
}

# ── Colours ───────────────────────────────────────────────────────────────────
def G(t): return f"\033[92m{t}\033[0m"
def Y(t): return f"\033[93m{t}\033[0m"
def R(t): return f"\033[91m{t}\033[0m"
def B(t): return f"\033[1m{t}\033[0m"
def C(t): return f"\033[96m{t}\033[0m"


# ─────────────────────────────────────────────────────────────────────────────
def send_whatsapp(trek_label: str, date: str, slots_info: str):
    msg = (
        f"🎯 TREK TICKETS AVAILABLE!\n"
        f"Trek  : {trek_label}\n"
        f"Date  : {date}\n"
        f"Slots : {slots_info}\n"
        f"Book  → {BASE_URL}\n"
        f"— BT Watcher"
    )
    if not PEAKY_API_URL:
        print(Y(f"\n  [WhatsApp stub] {msg}"))
        return
    try:
        r = requests.post(
            PEAKY_API_URL,
            headers={"Authorization": f"Bearer {PEAKY_API_KEY}",
                     "Content-Type": "application/json"},
            json={"to": WHATSAPP_TO, "message": msg},
            timeout=15,
        )
        print(G("  ✓ WhatsApp sent!") if r.ok else R(f"  ✗ WA {r.status_code}: {r.text[:100]}"))
    except Exception as e:
        print(R(f"  ✗ WA error: {e}"))


# ─────────────────────────────────────────────────────────────────────────────
def make_session() -> requests.Session:
    """Create a session with browser-like headers, set to English."""
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    # Switch site to English
    s.get(BASE_URL + "/lang/en", timeout=15)
    return s


def get_csrf_token(html: str) -> str | None:
    m = re.search(r'<input[^>]+name="_token"[^>]+value="([^"]+)"', html)
    return m.group(1) if m else None


def get_trek_id(session: requests.Session, district_id: str, keyword: str, token: str) -> str | None:
    """POST to /get-treks, find trek ID by keyword match."""
    try:
        r = session.post(
            BASE_URL + "/get-treks",
            data={"_token": token, "district_id": district_id},
            timeout=15,
        )
        treks = r.json()
        keyword_l = keyword.lower()
        for t in treks:
            name = str(t.get("name", "")).lower()
            if keyword_l in name:
                return str(t["id"]), str(t["name"])
        # No match — list what's available
        names = [t.get("name", "") for t in treks]
        print(Y(f"\n  Available treks in this district: {names}"))
        return None, None
    except Exception as e:
        print(R(f"  get-treks error: {e}"))
        return None, None


def check_once(session: requests.Session, trek_entry: dict, date_dmy: str) -> tuple[bool, str]:
    """
    Returns (available, info_string).
    date_dmy: DD-MM-YYYY
    """
    try:
        # Load homepage to get fresh CSRF token + cookies
        home = session.get(BASE_URL, timeout=20)
        token = get_csrf_token(home.text)
        if not token:
            return False, "could not get CSRF token"

        # Resolve trek ID dynamically
        trek_id, trek_real_name = get_trek_id(
            session, trek_entry["district_id"], trek_entry["keyword"], token
        )
        if not trek_id:
            return False, f"trek not found (keyword: {trek_entry['keyword']})"

        # POST to /availability
        r = session.post(
            BASE_URL + "/availability",
            data={
                "_token":   token,
                "district": trek_entry["district_id"],
                "trek":     trek_id,
                "check_in": date_dmy,
            },
            timeout=20,
            allow_redirects=True,
        )

        html = r.text

        # ── Parse slot availability ──────────────────────────────────────────
        # Site HTML: <div class="available_text ms-4">&nbsp;265/300 ಲಭ್ಯವಿದೆ</div>
        matches = re.findall(r'class="available_text[^"]*"[^>]*>.*?(\d+)/(\d+)', html, re.DOTALL)

        if matches:
            avail = int(matches[0][0])
            cap   = int(matches[0][1])
            info  = f"{avail}/{cap} slots open"
            return (avail > 0), info

        cl = html.lower()
        if any(k in cl for k in ["fully booked", "houseful", "no slot", "sold out"]):
            return False, "fully booked (0 slots)"
        if any(k in cl for k in ["select slot", "book now", "add visitor"]):
            return True, "slots open"

        return False, "no slots found"

    except Exception as e:
        return False, f"error: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print(B(C("""
╔══════════════════════════════════════════╗
║  👁  ARANYA VIHAARA AVAILABILITY WATCHER ║
║     Bengaluru Trekkers · Fast API Mode   ║
╚══════════════════════════════════════════╝""")))

    # Trek menu
    print(B("\n  Select Trek:"))
    for num, t in TREK_MENU.items():
        print(f"    {num}. {t['label']}")
    print()

    while True:
        choice = input("  Enter number: ").strip()
        if choice.isdigit() and int(choice) in TREK_MENU:
            trek_entry = TREK_MENU[int(choice)]
            break
        print(R("  Invalid — enter a number from the list"))

    date_raw = input("  Date (DD-MM-YYYY e.g. 10-06-2026): ").strip()
    # Accept YYYY-MM-DD too
    if re.match(r'\d{4}-\d{2}-\d{2}', date_raw):
        y, m, d = date_raw.split("-")
        date_dmy = f"{d}-{m}-{y}"
    else:
        date_dmy = date_raw

    interval = input(f"  Check every N seconds [{DEFAULT_INTERVAL}]: ").strip()
    interval = int(interval) if interval.isdigit() else DEFAULT_INTERVAL

    print(G(f"\n✓ Watching: {trek_entry['label']} on {date_dmy}"))
    print(f"  Every {interval}s  |  Ctrl+C to stop\n")

    session  = make_session()
    check_num = 0

    while True:
        check_num += 1
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] #{check_num} checking…", end=" ", flush=True)

        available, info = check_once(session, trek_entry, date_dmy)

        if available:
            print(G(f"🎯 AVAILABLE! → {info}"))
            send_whatsapp(trek_entry["label"], date_dmy, info)
            again = input("\n  Keep watching? (y/n) [y]: ").strip().lower()
            if again == "n":
                break
            session = make_session()
        else:
            print(R(f"❌ Not available → {info}"))

        for rem in range(interval, 0, -5):
            print(f"\r  Next check in {rem:3d}s…", end="", flush=True)
            time.sleep(min(5, rem))
        print("\r" + " " * 25 + "\r", end="")

    print("\nWatcher stopped.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nWatcher stopped.")
