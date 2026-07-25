"""
Aranya Vihaara audit — runs server-side with Playwright.
Called from server.py via POST /ticket-audit/run.
"""

import asyncio
import io
import re
from datetime import datetime, timezone
from typing import Optional

from playwright.async_api import async_playwright, Page, Browser

BASE_URL = "https://aranyavihaara.karnataka.gov.in"


# ── CAPTCHA helpers ────────────────────────────────────────────────────────────

async def _read_captcha_text_element(page: Page) -> str:
    try:
        text = await page.evaluate("""() => {
            const candidates = [...document.querySelectorAll('div, span, p, td, label')];
            for (const el of candidates) {
                const txt = (el.innerText || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(txt) && el.children.length === 0) {
                    const parent = el.closest('[class*="captcha" i], [id*="captcha" i]') || el.parentElement;
                    if (parent) return txt;
                }
            }
            return '';
        }""")
        text = re.sub(r'[^A-Za-z0-9]', '', text or '')
        if 4 <= len(text) <= 8:
            return text
    except Exception:
        pass
    return ''


async def _read_captcha_dom(page: Page) -> str:
    for sel in [".captcha-text", "#captcha", "[class*='captcha']", "canvas + span", ".captcha"]:
        try:
            el = page.locator(sel).first
            if await el.count() > 0:
                txt = re.sub(r'\s+', '', (await el.inner_text()).strip())
                if 4 <= len(txt) <= 8 and txt.isalnum():
                    return txt
        except Exception:
            pass
    return ""


async def _read_captcha_ocr(page: Page) -> str:
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance
        for sel in ['img[alt*="captcha" i]', 'img[src*="captcha" i]', '.captcha img']:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                img = Image.open(io.BytesIO(await loc.screenshot())).convert("L")
                img = img.resize((img.width * 3, img.height * 3), Image.LANCZOS)
                img = ImageEnhance.Contrast(img).enhance(2.5)
                img = img.filter(ImageFilter.SHARPEN)
                cfg = "--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                return re.sub(r'[^A-Za-z0-9]', '', pytesseract.image_to_string(img, config=cfg).strip())
    except Exception:
        pass
    return ""


async def _solve_captcha(page: Page) -> str:
    text = await _read_captcha_text_element(page)
    if text:
        return text
    text = await _read_captcha_dom(page)
    if text:
        return text
    return await _read_captcha_ocr(page)


async def _refresh_captcha(page: Page):
    for sel in ['button[onclick*="captcha" i]', '.refresh-captcha', 'a[onclick*="captcha" i]', '[title*="refresh" i]']:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.click()
                await page.wait_for_timeout(600)
                return
        except Exception:
            pass


# ── Login ──────────────────────────────────────────────────────────────────────

async def _do_login(page: Page, email: str, password: str) -> bool:
    await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(1500)

    # Step 1: Switch to English
    try:
        btn = page.locator('a:has-text("English"), button:has-text("English")')
        if await btn.count() > 0:
            await btn.first.click()
            await page.wait_for_timeout(1200)
    except Exception:
        pass

    # Step 2: Navigate to login form
    try:
        await page.locator('input[type="email"]').wait_for(timeout=2000)
    except Exception:
        for txt in ["Login", "ಲಾಗಿನ್", "Sign In"]:
            btn = page.locator(f'a:has-text("{txt}"), button:has-text("{txt}")')
            if await btn.count() > 0:
                await btn.first.click()
                await page.wait_for_timeout(1500)
                break
        if 'login' not in page.url:
            await page.goto(BASE_URL + '/login', wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1000)

    # Step 3: Fill credentials
    try:
        await page.fill('input[type="email"]', email)
        await page.fill('input[type="password"]', password)
    except Exception:
        return False

    for _ in range(4):
        captcha = await _solve_captcha(page)
        if not captcha:
            await _refresh_captcha(page)
            await page.wait_for_timeout(800)
            continue
        try:
            await page.fill('input[placeholder="Enter Captcha"]', captcha)
        except Exception:
            pass
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(2500)

        if any(x in page.url for x in ["/dashboard", "/my-booking", "/upcoming", "/profile"]):
            return True

        body = await page.inner_text("body")
        if "wrong captcha" in body.lower() or "invalid captcha" in body.lower():
            await _refresh_captcha(page)
            await page.wait_for_timeout(600)
            continue

        try:
            if await page.locator('a:has-text("Logout"), a:has-text("My Booking")').count() > 0:
                return True
        except Exception:
            pass

    return False


# ── Scraping ───────────────────────────────────────────────────────────────────

def _parse_booking_text(text: str) -> Optional[dict]:
    if not text or 'ticket' not in text.lower():
        return None
    def find(pattern, default=''):
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else default
    trek_name = ''
    for line in text.split('\n'):
        line = line.strip()
        if line and any(k in line.lower() for k in ['trek', 'peak', 'betta', 'gudda']):
            trek_name = line
            break
    return {
        'trekName': trek_name or 'Unknown Trek',
        'date':     find(r'(\d{2}[-/]\d{2}[-/]\d{2,4})'),
        'slot':     find(r'Slot\s*[:\s]*([^\n]+(?:AM|PM|am|pm))'),
        'ticketNo': find(r'Ticket\s*No[:\s.]*([A-Z0-9]+)'),
        'orderId':  find(r'Order\s*Id[:\s.]*([A-Z0-9]+)'),
        'district': find(r'District\s*[:\s]*([^\n]+)'),
        'visitors': [],
    }


async def _scrape_visitor_table(page: Page) -> list:
    try:
        rows = await page.evaluate("""() => {
            const results = [];
            for (const table of document.querySelectorAll('table')) {
                const hr = table.querySelector('tr');
                if (!hr) continue;
                const headers = Array.from(hr.querySelectorAll('th')).map(th => th.innerText.trim().toLowerCase());
                if (!headers.some(h => h.includes('name') || h.includes('visitor'))) continue;
                for (const row of table.querySelectorAll('tbody tr, tr:not(:first-child)')) {
                    const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                    if (cells.length >= 3 && cells[1])
                        results.push({ no: cells[0], name: cells[1], age: cells[2], gender: cells[3] || '', mobile: cells[4] || '', idType: cells[5] || '', idNumber: cells[6] || '' });
                }
            }
            return results;
        }""")
        return [v for v in rows if v.get('name')]
    except Exception:
        return []


async def _scrape_upcoming(page: Page) -> list:
    try:
        await page.goto(BASE_URL + "/my-booking/upcoming", wait_until="domcontentloaded", timeout=20000)
    except Exception:
        pass
    await page.wait_for_timeout(1500)

    view_btns = await page.query_selector_all('button:text("View Visitors"), a:text("View Visitors")')

    entries = await page.evaluate("""() => {
        const results = [];
        let cards = [];
        for (const sel of ['.card', '.booking-card', '[class*="booking"]']) {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) { cards = Array.from(els); break; }
        }
        if (cards.length === 0) {
            for (const el of document.querySelectorAll('*')) {
                if (el.children.length < 20 && el.innerText?.includes('Ticket No') && el.innerText.length < 2000)
                    cards.push(el);
            }
        }
        for (const card of cards) {
            const text = card.innerText || '';
            if (text.includes('Ticket No')) results.push({ text: text.trim() });
        }
        return results;
    }""")

    bookings = []
    for e in entries:
        b = _parse_booking_text(e.get('text', ''))
        if b:
            bookings.append(b)

    for i, btn in enumerate(view_btns):
        try:
            await btn.click()
            await page.wait_for_timeout(1200)
            visitors = await _scrape_visitor_table(page)
            if visitors and i < len(bookings):
                bookings[i]['visitors'] = visitors
        except Exception:
            pass

    return bookings


async def _audit_account(browser: Browser, cred: dict, semaphore: asyncio.Semaphore) -> dict:
    email = cred.get('email', '')
    label = cred.get('label', email.split('@')[0])
    result = {'email': email, 'label': label, 'status': 'pending', 'bookings': [], 'error': None}
    async with semaphore:
        ctx = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        )
        page = await ctx.new_page()
        try:
            if await _do_login(page, email, cred.get('password', '')):
                result['bookings'] = await _scrape_upcoming(page)
                result['status'] = 'ok'
            else:
                result['status'] = 'login_failed'
                result['error'] = 'Login failed (CAPTCHA or wrong credentials)'
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
        finally:
            await page.close()
            await ctx.close()
    return result


def _build_report(results: list) -> dict:
    trek_map = {}
    for acc in results:
        if acc['status'] != 'ok':
            continue
        for booking in acc['bookings']:
            key = (booking.get('trekName', 'Unknown'), booking.get('date', ''))
            if key not in trek_map:
                trek_map[key] = {
                    'trekName': key[0], 'date': key[1],
                    'slot': booking.get('slot', ''), 'district': booking.get('district', ''),
                    'totalTickets': 0, 'accounts': [],
                }
            entry = trek_map[key]
            visitors = booking.get('visitors', [])
            entry['totalTickets'] += len(visitors)
            entry['accounts'].append({
                'email': acc['email'], 'label': acc['label'],
                'ticketNo': booking.get('ticketNo', ''), 'orderId': booking.get('orderId', ''),
                'visitorCount': len(visitors), 'visitors': visitors,
            })
    return {
        'generatedAt':     datetime.now(timezone.utc).isoformat(),
        'totalAccounts':   len(results),
        'successAccounts': sum(1 for r in results if r['status'] == 'ok'),
        'failedAccounts':  [r['email'] for r in results if r['status'] != 'ok'],
        'treks':           sorted(trek_map.values(), key=lambda t: (t['date'], t['trekName'])),
        'rawResults':      results,
    }


# ── Public entry point ─────────────────────────────────────────────────────────

def _set_status(db, **kwargs):
    try:
        db.collection("aranya_audit_reports").document("run_status").set({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        })
    except Exception:
        pass


async def run_audit(db, limit: int = 0, concurrency: int = 3):
    _set_status(db, status="running", message="Loading credentials…", done=0, total=0)

    docs = list(db.collection("aranya_credentials").stream())
    creds = [
        {**d.to_dict(), '_id': d.id}
        for d in docs
        if d.to_dict().get('email') and d.to_dict().get('password') and d.to_dict().get('active', True)
    ]

    if not creds:
        _set_status(db, status="error", message="No active credentials found")
        return

    if limit:
        creds = creds[:limit]

    total = len(creds)
    _set_status(db, status="running", message=f"Auditing {total} accounts…", done=0, total=total)

    completed = 0
    semaphore = asyncio.Semaphore(concurrency)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
        )

        async def _run_one(cred):
            nonlocal completed
            result = await _audit_account(browser, cred, semaphore)
            completed += 1
            _set_status(db, status="running",
                        message=f"Completed {completed}/{total} accounts…",
                        done=completed, total=total)
            return result

        results = await asyncio.gather(*[_run_one(c) for c in creds])
        await browser.close()

    report = _build_report(list(results))

    db.collection("aranya_audit_reports").document("latest").set(report)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    db.collection("aranya_audit_reports").document(ts).set(report)

    _set_status(
        db,
        status="done",
        message=f"Done — {report['successAccounts']}/{report['totalAccounts']} accounts, "
                f"{len(report['treks'])} trek(s), "
                f"{report.get('treks') and sum(t['totalTickets'] for t in report['treks']) or 0} ticket(s)",
        done=total,
        total=total,
        finished_at=datetime.now(timezone.utc).isoformat(),
    )
