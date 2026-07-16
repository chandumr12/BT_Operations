"""Trek ticket availability watcher — async engine for BT Ops API."""
import re
import time
import asyncio
import requests
from datetime import datetime, timezone
from typing import Dict, Any

BASE_URL = "https://aranyavihaara.karnataka.gov.in"

DISTRICTS = [
    {"id": "24", "name": "Dakshina Kannada"},
    {"id": "17", "name": "Chikmagalur"},
    {"id": "25", "name": "Kodagu"},
    {"id": "19", "name": "Kolar"},
    {"id": "15", "name": "Shivamogga"},
    {"id": "16", "name": "Udupi"},
    {"id": "28", "name": "Chikkaballapur"},
    {"id": "29", "name": "Ramanagara"},
    {"id": "21", "name": "Bengaluru Rural"},
    {"id": "27", "name": "Chamarajanagara"},
    {"id": "4",  "name": "Kalaburagi"},
]

active_watchers: Dict[str, Any] = {}

watcher_config: Dict[str, Any] = {
    "notify_numbers": [],
}


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        ),
        "Accept-Language": "en-IN,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    # Warm up session and grab initial CSRF token
    try:
        home = s.get(BASE_URL, timeout=15)
        token = _get_csrf_token(home.text)
        if token:
            s._csrf_token = token  # cache on session object
    except Exception:
        pass
    return s


def _get_csrf_token(html: str) -> str | None:
    m = re.search(r'<input[^>]+name="_token"[^>]+value="([^"]+)"', html)
    return m.group(1) if m else None


def fetch_treks_for_district(district_id: str) -> list:
    s = _make_session()
    try:
        home = s.get(BASE_URL, timeout=20)
        token = _get_csrf_token(home.text)
        if not token:
            return []
        r = s.post(BASE_URL + "/get-treks", data={"_token": token, "district_id": district_id}, timeout=15)
        return [{"id": str(t["id"]), "name": str(t.get("name", ""))} for t in r.json()]
    except Exception:
        return []


def _check_once(district_id: str, trek_id: str, date_dmy: str, session: requests.Session) -> tuple[bool, str]:
    """Single availability check. Reuses cached CSRF token — only hits homepage when token expires."""
    try:
        token = getattr(session, '_csrf_token', None)

        # Only fetch homepage (slow) if we have no cached token
        if not token:
            home = session.get(BASE_URL, timeout=10)
            token = _get_csrf_token(home.text)
            if not token:
                return False, "could not get CSRF token"
            session._csrf_token = token

        r = session.post(
            BASE_URL + "/availability",
            data={"_token": token, "district": district_id, "trek": trek_id, "check_in": date_dmy},
            timeout=8,
            allow_redirects=True,
        )
        html = r.text

        # Token expired if we were redirected away from /availability (back to homepage)
        if r.history and "/availability" not in r.url:
            fresh_token = _get_csrf_token(html)
            if fresh_token:
                session._csrf_token = fresh_token
                r = session.post(
                    BASE_URL + "/availability",
                    data={"_token": fresh_token, "district": district_id, "trek": trek_id, "check_in": date_dmy},
                    timeout=8,
                    allow_redirects=True,
                )
                html = r.text

        matches = re.findall(r'class="available_text[^"]*"[^>]*>.*?(\d+)/(\d+)', html, re.DOTALL)
        if matches:
            avail = int(matches[0][0])
            cap   = int(matches[0][1])
            return (avail > 0), f"{avail}/{cap} slots open"
        cl = html.lower()
        if any(k in cl for k in ["fully booked", "houseful", "no slot", "sold out"]):
            return False, "fully booked"
        if any(k in cl for k in ["select slot", "book now", "add visitor"]):
            return True, "slots open"
        return False, "no slots found"

    except Exception as e:
        session._csrf_token = None  # force token refresh on next check
        return False, f"error: {e}"


async def _fetch_notify_numbers(db, loop) -> list:
    try:
        doc = await loop.run_in_executor(
            None,
            lambda: db.collection("settings").document("trek_watcher_config").get(),
        )
        if doc.exists:
            return doc.to_dict().get("notify_numbers", [])
    except Exception:
        pass
    return list(watcher_config.get("notify_numbers", []))


def _save_watcher_history(db, job_id: str):
    """Blocking — run in executor. Saves watcher state to Firestore."""
    if job_id not in active_watchers:
        return
    data = {k: v for k, v in active_watchers[job_id].items() if k != "_task"}
    try:
        db.collection("trek_watcher_history").document(job_id).set(data)
    except Exception as e:
        print(f"[Watcher] Failed to save history for {job_id}: {e}")


def _save_last_alert(db, trek_name: str, date_dmy: str, info: str, alerted_at: str):
    """Blocking — run in executor. Saves global last-alert record."""
    try:
        db.collection("settings").document("last_trek_alert").set({
            "trek_name":  trek_name,
            "date":       date_dmy,
            "slots_info": info,
            "alerted_at": alerted_at,
        })
    except Exception as e:
        print(f"[Watcher] Failed to save last_alert: {e}")


async def run_watcher(
    job_id: str,
    district_id: str,
    trek_id: str,
    date_dmy: str,
    duration_secs: int,
    interval_secs: int,
    db=None,
):
    from whatsapp import send_trek_alert_all

    loop     = asyncio.get_running_loop()
    session  = await loop.run_in_executor(None, _make_session)
    end_time = time.monotonic() + duration_secs

    # Pre-fetch notify numbers from Firestore now — don't rely on in-memory watcher_config
    # which will be empty after a server redeploy
    numbers = await _fetch_notify_numbers(db, loop) if db else list(watcher_config.get("notify_numbers", []))
    print(f"[Watcher] Starting {job_id} — {len(numbers)} notify number(s), interval={interval_secs}s")

    active_watchers[job_id]["status"] = "running"

    try:
        while time.monotonic() < end_time:
            # ── Per-iteration guard: no exception can kill this loop except CancelledError ──
            t0 = time.monotonic()
            try:
                w = active_watchers.get(job_id, {})
                if w.get("status") == "stopped":
                    break

                available, info = await loop.run_in_executor(
                    None, lambda: _check_once(district_id, trek_id, date_dmy, session)
                )
                check_ms = int((time.monotonic() - t0) * 1000)
                print(f"[Watcher] {job_id[:8]} check={check_ms}ms available={available} → {info[:50]}")

                if job_id in active_watchers:
                    active_watchers[job_id].update({
                        "checks":       active_watchers[job_id].get("checks", 0) + 1,
                        "available":    available,
                        "last_info":    info,
                        "last_checked": datetime.now(timezone.utc).isoformat(),
                        "status":       "available" if available else "running",
                    })

                if available and job_id in active_watchers:
                    trek_name  = active_watchers[job_id].get("trek_name", "")
                    alerted_at = datetime.now(timezone.utc).isoformat()
                    active_watchers[job_id]["last_alerted"] = alerted_at

                    print(f"[Watcher] ALERT → {len(numbers)} number(s) for {trek_name} — firing immediately")

                    # Fire threads immediately — no await, loop continues at full speed
                    if numbers:
                        _nums, _tn, _dt, _inf = numbers[:], trek_name, date_dmy, info
                        loop.run_in_executor(None, lambda: send_trek_alert_all(_nums, _tn, _dt, _inf))
                    if db:
                        _jid2 = job_id
                        loop.run_in_executor(None, lambda: _save_watcher_history(db, _jid2))
                        _tn2, _dt2, _inf2, _at2 = trek_name, date_dmy, info, alerted_at
                        loop.run_in_executor(None, lambda: _save_last_alert(db, _tn2, _dt2, _inf2, _at2))

            except asyncio.CancelledError:
                raise  # let the outer handler catch it
            except Exception as e:
                print(f"[Watcher] Iteration error (non-fatal, continuing): {e}")

            # Deduct actual check time from sleep so wall-clock interval stays accurate.
            # e.g. check took 5s + interval 30s → sleep only 25s more, not 35s total.
            elapsed   = time.monotonic() - t0
            sleep_for = max(0, interval_secs - elapsed)
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)

    except asyncio.CancelledError:
        pass
    finally:
        if job_id in active_watchers and active_watchers[job_id].get("status") != "stopped":
            active_watchers[job_id]["status"] = "done"
        if db and job_id in active_watchers:
            await loop.run_in_executor(None, lambda: _save_watcher_history(db, job_id))
