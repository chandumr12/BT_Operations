"""
Aranya Vihaara audit — runs server-side with Playwright.
Called from server.py via POST /ticket-audit/run.
"""

import asyncio
import io
import re
from datetime import datetime, timezone

from playwright.async_api import async_playwright, Page, Browser

BASE_URL = "https://aranyavihaara.karnataka.gov.in"


# ── CAPTCHA helpers ────────────────────────────────────────────────────────────
# The Aranya Vihaara CAPTCHA is plain text in a readonly <input> box.
# el.innerText is empty for inputs — must use el.value. Multiple strategies below.

async def _read_captcha_input_value(page: Page) -> str:
    """
    Primary strategy: the CAPTCHA display is a readonly <input> whose .value
    holds the code (e.g. 'Ry6RU'). Use Playwright's input_value() API.
    """
    # Specific selectors for the captcha display input (NOT the 'Enter Captcha' field)
    selectors = [
        'input[readonly]',
        'input[disabled]',
        'input[name*="captcha" i]:not([placeholder])',
        'input[id*="captcha" i]:not([placeholder])',
        'input[class*="captcha" i]:not([placeholder])',
    ]
    for sel in selectors:
        try:
            locs = page.locator(sel)
            count = await locs.count()
            for i in range(count):
                loc = locs.nth(i)
                val = await loc.input_value()
                val = re.sub(r'[^A-Za-z0-9]', '', val.strip())
                if 4 <= len(val) <= 8:
                    return val
        except Exception:
            pass
    return ''


async def _read_captcha_dom_js(page: Page) -> str:
    """
    JS evaluate covering:
      1. input.value for readonly/disabled inputs
      2. elements with 'captcha' in class/id
      3. leaf elements with short alphanumeric innerText
    """
    try:
        text = await page.evaluate("""() => {
            // 1. Readonly / disabled inputs → .value (innerText is empty for inputs)
            for (const el of document.querySelectorAll('input[readonly], input[disabled]')) {
                const v = (el.value || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(v)) return v;
            }

            // 2. Any element with 'captcha' in class or id
            for (const el of document.querySelectorAll('[class*="captcha" i], [id*="captcha" i]')) {
                const txt = (el.value || el.innerText || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(txt)) return txt;
                // Check direct children
                for (const c of el.querySelectorAll('*')) {
                    const ct = (c.value || c.innerText || '').trim().replace(/\\s+/g, '');
                    if (/^[A-Za-z0-9]{4,8}$/.test(ct)) return ct;
                }
            }

            // 3. Leaf elements with short alnum text (div/span/b/strong/code/td/p)
            for (const el of document.querySelectorAll(
                'div, span, p, td, label, b, strong, code, li'
            )) {
                if (el.children.length > 0) continue;
                const txt = (el.innerText || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(txt)) return txt;
            }

            return '';
        }""")
        text = re.sub(r'[^A-Za-z0-9]', '', text or '')
        if 4 <= len(text) <= 8:
            return text
    except Exception:
        pass
    return ''


async def _read_captcha_screenshot_ocr(page: Page) -> str:
    """
    Screenshot the CAPTCHA display element and run pytesseract OCR on it.
    Works both for readonly-input style and image-based CAPTCHAs.
    """
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance

        # Candidate selectors for the captcha DISPLAY box (not the entry field)
        display_selectors = [
            'input[readonly]',
            'input[disabled]',
            '[class*="captcha" i]:not([placeholder])',
            '[id*="captcha" i]:not([placeholder])',
            'img[alt*="captcha" i]',
            'img[src*="captcha" i]',
            'canvas[id*="captcha" i]',
        ]

        for sel in display_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.count() == 0:
                    continue

                # For input elements, try reading value directly first
                try:
                    val = await loc.input_value()
                    val = re.sub(r'[^A-Za-z0-9]', '', val.strip())
                    if 4 <= len(val) <= 8:
                        return val
                except Exception:
                    pass

                # Screenshot + OCR
                data = await loc.screenshot()
                if not data:
                    continue

                img = Image.open(io.BytesIO(data)).convert('L')
                # Upscale and sharpen for better OCR
                scale = max(3, 60 // img.height) if img.height < 60 else 3
                img = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
                img = ImageEnhance.Contrast(img).enhance(3.0)
                img = ImageEnhance.Sharpness(img).enhance(2.0)
                img = img.filter(ImageFilter.SHARPEN)

                cfg = (
                    "--psm 8 --oem 3 "
                    "-c tessedit_char_whitelist="
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                )
                result = re.sub(
                    r'[^A-Za-z0-9]', '',
                    pytesseract.image_to_string(img, config=cfg).strip()
                )
                if 4 <= len(result) <= 8:
                    return result
            except Exception:
                continue

    except Exception:
        pass
    return ''


async def _solve_captcha(page: Page) -> str:
    """Three-tier CAPTCHA solving: input.value → JS DOM scan → screenshot OCR."""
    # 1. Playwright input_value() on readonly inputs (fastest, most reliable)
    text = await _read_captcha_input_value(page)
    if text:
        return text
    # 2. JS evaluate — covers innerText + input.value in one pass
    text = await _read_captcha_dom_js(page)
    if text:
        return text
    # 3. Screenshot + pytesseract OCR (last resort)
    return await _read_captcha_screenshot_ocr(page)


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

        # /bookinginfo is the real post-login URL (not /my-booking/upcoming)
        if any(x in page.url for x in ["/bookinginfo", "/dashboard", "/my-booking", "/profile"]):
            return True

        body = await page.inner_text("body")
        if "wrong captcha" in body.lower() or "invalid captcha" in body.lower():
            await _refresh_captcha(page)
            await page.wait_for_timeout(600)
            continue

        try:
            if await page.locator('a:has-text("Logout"), a:has-text("My Bookings"), a:has-text("Upcoming Treks")').count() > 0:
                return True
        except Exception:
            pass

    return False


# ── Scraping ───────────────────────────────────────────────────────────────────


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
    # /bookinginfo is the correct post-login page for upcoming treks
    # (/my-booking/upcoming gives 404)
    if '/bookinginfo' not in page.url:
        try:
            await page.goto(BASE_URL + "/bookinginfo", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1500)
        except Exception:
            pass

    # Parse booking cards — each card has: trek name heading, District, Slot, Ticket No, Order Id
    bookings = await page.evaluate("""() => {
        const results = [];

        // Find the smallest ancestor elements that each contain "Ticket No" text
        // (these are the individual booking cards)
        const seen = new Set();
        const candidates = [];
        for (const el of document.querySelectorAll('*')) {
            const txt = el.innerText || '';
            if (!txt.includes('Ticket No') || txt.length > 5000) continue;
            // Prefer the tightest (smallest) container
            if (el.parentElement && (el.parentElement.innerText || '').includes('Ticket No')) continue;
            if (!seen.has(el)) {
                seen.add(el);
                candidates.push(el);
            }
        }

        for (const card of candidates) {
            const text = card.innerText || '';

            // Trek name: first non-empty line that looks like a proper name
            // (not a label like "District :", "Booked", etc.)
            let trekName = '';
            for (const line of text.split('\\n')) {
                const l = line.trim();
                if (!l || l.toLowerCase().includes('booked') || l.includes(':') || l.length < 4) continue;
                if (/^[A-Z]/.test(l) && l.length > 3) { trekName = l; break; }
            }

            const get = (re) => { const m = text.match(re); return m ? m[1].trim() : ''; };

            results.push({
                trekName: trekName || 'Unknown Trek',
                district: get(/District\\s*[:\\s]+([^\\n]+)/i),
                date:     get(/(\\d{2}[-/]\\d{2}[-/]\\d{2,4})/),
                slot:     get(/Slot\\s*[:\\s]+([^\\n]+)/i),
                ticketNo: get(/Ticket\\s*No[:\\s.]*(\\S+)/i),
                orderId:  get(/Order\\s*Id[:\\s.]*(\\S+)/i),
                visitors: [],
                _el_index: results.length,
            });
        }
        return results;
    }""")

    if not bookings:
        return []

    # Click each "View Visitors" button and collect visitor data
    view_btns = await page.locator('button:has-text("View Visitors"), a:has-text("View Visitors")').all()

    for i, btn in enumerate(view_btns):
        try:
            await btn.click()
            await page.wait_for_timeout(1500)

            visitors = await _scrape_visitor_table(page)
            if i < len(bookings):
                bookings[i]['visitors'] = visitors

            # Close any modal that opened
            for close_sel in [
                'button:has-text("Close")',
                'button.close',
                '[data-dismiss="modal"]',
                '.modal-close',
                'button:has-text("×")',
                'button[aria-label="Close"]',
            ]:
                try:
                    cl = page.locator(close_sel).first
                    if await cl.count() > 0:
                        await cl.click()
                        await page.wait_for_timeout(500)
                        break
                except Exception:
                    pass
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
