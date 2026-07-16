"""PickyAssist WhatsApp sender — server-side only, never throws."""
import re
import os
import requests

# Persistent session reuses the TCP connection to PickyAssist — saves ~200ms per alert
_session = requests.Session()
_session.headers.update({"Content-Type": "application/json"})


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        return "91" + digits
    if len(digits) == 11 and digits.startswith("0"):
        return "91" + digits[1:]
    if len(digits) == 12 and digits.startswith("91"):
        return digits
    return digits


def send_template_batch(phones: list[str], template_id: str, params: list[str]) -> bool:
    """Send one template to ALL phones in a single API call — fastest path."""
    base_url = os.getenv("PICKYASSIST_BASE_URL", "")
    token    = os.getenv("PICKYASSIST_TOKEN", "")
    app_id   = int(os.getenv("PICKYASSIST_APP_ID", "121"))

    print(f"[WhatsApp] batch → {len(phones)} number(s) template={template_id} params={params}")
    print(f"[WhatsApp] config → base_url={'SET' if base_url else 'MISSING'} token={'SET' if token else 'MISSING'}")

    if not all([base_url, token, template_id, phones]):
        print("[WhatsApp] SKIP — not fully configured")
        return False

    numbers = [normalize_phone(p) for p in phones]
    payload = {
        "token":       token,
        "application": app_id,
        "template_id": template_id,
        "data": [
            {"number": n, "template_message": params, "language": "en"}
            for n in numbers
        ],
    }
    print(f"[WhatsApp] POST {base_url}/api/v2/push  numbers={numbers}")

    try:
        r = _session.post(f"{base_url}/api/v2/push", json=payload, timeout=5)
        print(f"[WhatsApp] Response {r.status_code}: {r.text[:300]}")
        return r.ok and r.json().get("status") == 100
    except Exception as e:
        print(f"[WhatsApp] Exception: {e}")
        return False


def send_template(phone: str, template_id: str, params: list[str]) -> bool:
    """Send to a single phone. Uses batch under the hood."""
    return send_template_batch([phone], template_id, params)


def send_trek_alert(phone: str, trek_name: str, date: str, slots_info: str) -> bool:
    template_id = os.getenv("PICKYASSIST_TEMPLATE_TREK_ALERT", "")
    return send_template(phone, template_id, [trek_name, date, slots_info])


def send_trek_alert_all(numbers: list[str], trek_name: str, date: str, slots_info: str):
    """Send to all numbers in ONE PickyAssist API call."""
    template_id = os.getenv("PICKYASSIST_TEMPLATE_TREK_ALERT", "")
    print(f"[WhatsApp] send_trek_alert_all (batch) → {len(numbers)} number(s): {numbers}")
    if numbers and template_id:
        send_template_batch(numbers, template_id, [trek_name, date, slots_info])
