#!/usr/bin/env python3
"""
Aranya Vihaara Ticket Audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Logs into each saved account, scrapes all upcoming trek bookings + visitor
details, and uploads a consolidated report to Firestore.

Usage:
    python ticket_audit.py                    # audit all accounts from Firestore
    python ticket_audit.py --limit 5          # first 5 accounts only (test run)
    python ticket_audit.py --concurrency 3    # 3 accounts at a time (default 3)

Requirements:
    pip install playwright pytesseract pillow firebase-admin
    playwright install chromium
    # macOS: brew install tesseract
"""

import asyncio
import argparse
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Firebase ──────────────────────────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore

def _init_firebase():
    key_paths = [
        Path(__file__).parent.parent / "backend" / "firebase-key.json",
        Path(__file__).parent / "firebase-key.json",
        Path(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")),
    ]
    for p in key_paths:
        if p and p.exists():
            cred = credentials.Certificate(str(p))
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            return firestore.client()
    # Try default credentials (Cloud Run / ADC)
    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        return firestore.client()
    except Exception as e:
        print(f"[Firebase] Could not init: {e}")
        return None

db = _init_firebase()

# ── Playwright ────────────────────────────────────────────────────────────────
from playwright.async_api import async_playwright, Page, BrowserContext, Browser

BASE_URL = "https://aranyavihaara.karnataka.gov.in"

# Colours
def clr(t, c): return f"\033[{c}m{t}\033[0m"
OK   = lambda t: clr(t, "92")
WARN = lambda t: clr(t, "93")
ERR  = lambda t: clr(t, "91")
INFO = lambda t: clr(t, "96")
BOLD = lambda t: clr(t, "1")


# ── CAPTCHA solver ────────────────────────────────────────────────────────────
async def _read_captcha_input_value(page: Page) -> str:
    """Primary: CAPTCHA display is a readonly input whose .value holds the code."""
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
            for i in range(await locs.count()):
                val = re.sub(r'[^A-Za-z0-9]', '', (await locs.nth(i).input_value()).strip())
                if 4 <= len(val) <= 8:
                    print(INFO(f"      [CAPTCHA] input.value → '{val}'"))
                    return val
        except Exception:
            pass
    return ''


async def _read_captcha_dom_js(page: Page) -> str:
    """JS evaluate: covers input.value + innerText + captcha-named elements."""
    try:
        text = await page.evaluate("""() => {
            for (const el of document.querySelectorAll('input[readonly], input[disabled]')) {
                const v = (el.value || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(v)) return v;
            }
            for (const el of document.querySelectorAll('[class*="captcha" i], [id*="captcha" i]')) {
                const txt = (el.value || el.innerText || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(txt)) return txt;
                for (const c of el.querySelectorAll('*')) {
                    const ct = (c.value || c.innerText || '').trim().replace(/\\s+/g, '');
                    if (/^[A-Za-z0-9]{4,8}$/.test(ct)) return ct;
                }
            }
            for (const el of document.querySelectorAll('div,span,p,td,label,b,strong,code')) {
                if (el.children.length > 0) continue;
                const txt = (el.innerText || '').trim().replace(/\\s+/g, '');
                if (/^[A-Za-z0-9]{4,8}$/.test(txt)) return txt;
            }
            return '';
        }""")
        text = re.sub(r'[^A-Za-z0-9]', '', text or '')
        if 4 <= len(text) <= 8:
            print(INFO(f"      [CAPTCHA] JS DOM → '{text}'"))
            return text
    except Exception:
        pass
    return ''


async def _read_captcha_screenshot_ocr(page: Page) -> str:
    """Screenshot the CAPTCHA display element and OCR it."""
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance

        display_selectors = [
            'input[readonly]', 'input[disabled]',
            '[class*="captcha" i]:not([placeholder])',
            '[id*="captcha" i]:not([placeholder])',
            'img[alt*="captcha" i]', 'img[src*="captcha" i]',
            'canvas[id*="captcha" i]',
        ]
        for sel in display_selectors:
            try:
                loc = page.locator(sel).first
                if await loc.count() == 0:
                    continue
                try:
                    val = re.sub(r'[^A-Za-z0-9]', '', (await loc.input_value()).strip())
                    if 4 <= len(val) <= 8:
                        return val
                except Exception:
                    pass
                data = await loc.screenshot()
                if not data:
                    continue
                img = Image.open(io.BytesIO(data)).convert('L')
                scale = max(3, 60 // img.height) if img.height < 60 else 3
                img = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
                img = ImageEnhance.Contrast(img).enhance(3.0)
                img = ImageEnhance.Sharpness(img).enhance(2.0)
                img = img.filter(ImageFilter.SHARPEN)
                cfg = "--psm 8 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                result = re.sub(r'[^A-Za-z0-9]', '', pytesseract.image_to_string(img, config=cfg).strip())
                if 4 <= len(result) <= 8:
                    print(INFO(f"      [CAPTCHA] OCR → '{result}'"))
                    return result
            except Exception:
                continue
    except Exception as e:
        print(WARN(f"   [OCR] {e}"))
    return ''


async def solve_captcha(page: Page) -> str:
    """Three-tier: input.value → JS DOM scan → screenshot OCR."""
    text = await _read_captcha_input_value(page)
    if text:
        return text
    text = await _read_captcha_dom_js(page)
    if text:
        return text
    return await _read_captcha_screenshot_ocr(page)


async def _refresh_captcha(page: Page):
    for sel in ['button[onclick*="captcha" i]', '.refresh-captcha', 'button.refresh',
                'a[onclick*="captcha" i]', '[title*="refresh" i]']:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.click()
                await page.wait_for_timeout(600)
                return
        except Exception:
            pass




# ── Login ─────────────────────────────────────────────────────────────────────
async def do_login(page: Page, email: str, password: str, label: str) -> bool:
    await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(1500)

    # ── Step 1: Switch to English if page is in Kannada ──────────────────────
    try:
        english_btn = page.locator('a:has-text("English"), button:has-text("English")')
        if await english_btn.count() > 0:
            print(INFO(f"   [{label}] Switching to English…"))
            await english_btn.first.click()
            await page.wait_for_timeout(1200)
    except Exception:
        pass

    # ── Step 2: Click the Login link in the top nav ───────────────────────────
    try:
        # Check if already on login page (email field visible)
        await page.locator('input[type="email"]').wait_for(timeout=2000)
    except Exception:
        # Not on login page yet — click the Login nav link
        for txt in ["Login", "ಲಾಗಿನ್", "Sign In"]:
            btn = page.locator(f'a:has-text("{txt}"), button:has-text("{txt}")')
            if await btn.count() > 0:
                await btn.first.click()
                await page.wait_for_timeout(1500)
                break
        # Also try navigating directly to /login
        if 'login' not in page.url:
            await page.goto(BASE_URL + '/login', wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1000)

    # ── Step 3: Fill email + password ────────────────────────────────────────
    try:
        await page.fill('input[type="email"]', email)
        await page.fill('input[type="password"]', password)
    except Exception as e:
        print(ERR(f"   [{label}] Could not fill login fields: {e}"))
        return False

    for attempt in range(4):
        captcha = await solve_captcha(page)
        if not captcha:
            print(WARN(f"   [{label}] CAPTCHA OCR failed (attempt {attempt+1}), refreshing…"))
            await _refresh_captcha(page)
            await page.wait_for_timeout(800)
            continue

        print(INFO(f"   [{label}] CAPTCHA → '{captcha}' (attempt {attempt+1})"))
        try:
            await page.fill('input[placeholder="Enter Captcha"]', captcha)
        except Exception:
            pass

        await page.click('button[type="submit"]')
        await page.wait_for_timeout(2500)

        url = page.url
        # /bookinginfo is the real post-login URL for upcoming treks
        if any(x in url for x in ["/bookinginfo", "/dashboard", "/my-booking", "/profile"]):
            return True

        # Check for wrong captcha error
        page_text = await page.inner_text("body")
        if "wrong captcha" in page_text.lower() or "invalid captcha" in page_text.lower():
            await _refresh_captcha(page)
            await page.wait_for_timeout(600)
            continue

        # Might have logged in anyway — check nav
        try:
            if await page.locator('a:has-text("Logout"), a:has-text("My Bookings"), a:has-text("Upcoming Treks")').count() > 0:
                return True
        except Exception:
            pass

    return False


# ── Scrape upcoming bookings ──────────────────────────────────────────────────
async def scrape_upcoming(page: Page, label: str) -> list:
    """Scrape all upcoming trek bookings from /bookinginfo."""
    # /bookinginfo is the correct page — /my-booking/upcoming gives 404
    if '/bookinginfo' not in page.url:
        try:
            await page.goto(BASE_URL + "/bookinginfo", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(1500)
        except Exception:
            pass

    # Parse booking cards — find smallest DOM elements containing "Ticket No"
    bookings = await page.evaluate("""() => {
        const results = [];
        const seen = new Set();
        for (const el of document.querySelectorAll('*')) {
            const txt = el.innerText || '';
            if (!txt.includes('Ticket No') || txt.length > 5000) continue;
            // Keep only the tightest (innermost) container
            if (el.parentElement && (el.parentElement.innerText || '').includes('Ticket No')) continue;
            if (seen.has(el)) continue;
            seen.add(el);

            // Trek name: first capitalised line that isn't a label
            let trekName = '';
            for (const line of txt.split('\\n')) {
                const l = line.trim();
                if (!l || l.toLowerCase().includes('booked') || l.includes(':') || l.length < 4) continue;
                if (/^[A-Z]/.test(l)) { trekName = l; break; }
            }

            const get = (re) => { const m = txt.match(re); return m ? m[1].trim() : ''; };
            results.push({
                trekName: trekName || 'Unknown Trek',
                district: get(/District\\s*[:\\s]+([^\\n]+)/i),
                date:     get(/(\\d{2}[-/]\\d{2}[-/]\\d{2,4})/),
                slot:     get(/Slot\\s*[:\\s]+([^\\n]+)/i),
                ticketNo: get(/Ticket\\s*No[:\\s.]*(\\S+)/i),
                orderId:  get(/Order\\s*Id[:\\s.]*(\\S+)/i),
                visitors: [],
            });
        }
        return results;
    }""")

    print(INFO(f"   [{label}] Found {len(bookings)} booking card(s)"))

    # Click each "View Visitors" and collect visitor data
    view_btns = await page.locator('button:has-text("View Visitors"), a:has-text("View Visitors")').all()
    for i, btn in enumerate(view_btns):
        try:
            await btn.click()
            await page.wait_for_timeout(1500)
            visitors = await _scrape_visitor_table(page)
            if i < len(bookings):
                bookings[i]['visitors'] = visitors
            # Close modal if one opened
            for close_sel in [
                'button:has-text("Close")', 'button.close',
                '[data-dismiss="modal"]', '.modal-close',
                'button:has-text("×")', 'button[aria-label="Close"]',
            ]:
                try:
                    cl = page.locator(close_sel).first
                    if await cl.count() > 0:
                        await cl.click()
                        await page.wait_for_timeout(500)
                        break
                except Exception:
                    pass
        except Exception as e:
            print(WARN(f"   [{label}] View Visitors {i+1} failed: {e}"))

    print(OK(f"   [{label}] Done — {sum(len(b.get('visitors',[])) for b in bookings)} visitor(s) total"))
    return bookings



async def _scrape_visitor_table(page: Page) -> list:
    """Extract visitor rows from the Visitors Details table."""
    visitors = []
    try:
        rows = await page.evaluate("""() => {
            const results = [];
            // Find visitor tables
            const tables = document.querySelectorAll('table');
            for (const table of tables) {
                const headerRow = table.querySelector('tr');
                if (!headerRow) continue;
                const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.innerText.trim().toLowerCase());
                if (!headers.some(h => h.includes('name') || h.includes('visitor'))) continue;

                const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
                for (const row of rows) {
                    const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                    if (cells.length >= 3 && cells[1]) {
                        results.push({
                            no:       cells[0] || '',
                            name:     cells[1] || '',
                            age:      cells[2] || '',
                            gender:   cells[3] || '',
                            mobile:   cells[4] || '',
                            idType:   cells[5] || '',
                            idNumber: cells[6] || '',
                        });
                    }
                }
            }
            return results;
        }""")
        visitors = [v for v in rows if v.get('name')]
    except Exception:
        pass
    return visitors


# ── Per-account audit ─────────────────────────────────────────────────────────
async def audit_account(
    browser: Browser,
    cred: dict,
    semaphore: asyncio.Semaphore,
) -> dict:
    email = cred.get('email', '')
    password = cred.get('password', '')
    label = email.split('@')[0]

    result = {
        'email':    email,
        'label':    cred.get('label', label),
        'status':   'pending',
        'bookings': [],
        'error':    None,
    }

    async with semaphore:
        print(INFO(f"\n→ Auditing {BOLD(email)}"))
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        try:
            logged_in = await do_login(page, email, password, label)
            if not logged_in:
                result['status'] = 'login_failed'
                result['error'] = 'Login failed (CAPTCHA or wrong credentials)'
                print(ERR(f"   [{label}] Login FAILED"))
            else:
                print(OK(f"   [{label}] Logged in ✓"))
                bookings = await scrape_upcoming(page, label)
                result['bookings'] = bookings
                result['status'] = 'ok'
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            print(ERR(f"   [{label}] ERROR: {e}"))
        finally:
            await page.close()
            await context.close()

    return result


# ── Aggregate report ──────────────────────────────────────────────────────────
def build_report(results: list) -> dict:
    """Group results by trek + date."""
    trek_map = {}  # key: (trekName, date) → {trek info, accounts, visitor_count}

    for account in results:
        if account['status'] != 'ok':
            continue
        for booking in account['bookings']:
            key = (booking.get('trekName', 'Unknown'), booking.get('date', ''))
            if key not in trek_map:
                trek_map[key] = {
                    'trekName':     key[0],
                    'date':         key[1],
                    'slot':         booking.get('slot', ''),
                    'district':     booking.get('district', ''),
                    'totalTickets': 0,
                    'accounts':     [],
                }
            entry = trek_map[key]
            visitors = booking.get('visitors', [])
            entry['totalTickets'] += len(visitors)
            entry['accounts'].append({
                'email':       account['email'],
                'label':       account['label'],
                'ticketNo':    booking.get('ticketNo', ''),
                'orderId':     booking.get('orderId', ''),
                'visitorCount': len(visitors),
                'visitors':    visitors,
            })

    return {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'totalAccounts': len(results),
        'successAccounts': sum(1 for r in results if r['status'] == 'ok'),
        'failedAccounts':  [r['email'] for r in results if r['status'] != 'ok'],
        'treks':   sorted(trek_map.values(), key=lambda t: (t['date'], t['trekName'])),
        'rawResults': results,
    }


# ── Firestore helpers ─────────────────────────────────────────────────────────
def load_credentials() -> list:
    if not db:
        print(ERR("No Firestore connection — can't load credentials."))
        return []
    docs = list(db.collection("aranya_credentials").stream())
    creds = []
    for d in docs:
        data = d.to_dict()
        data['_id'] = d.id
        if data.get('email') and data.get('password') and data.get('active', True):
            creds.append(data)
    print(INFO(f"Loaded {len(creds)} active credential(s) from Firestore."))
    return creds


def save_report(report: dict):
    if not db:
        print(WARN("No Firestore — saving report to audit_report.json locally."))
        with open("audit_report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)
        return
    db.collection("aranya_audit_reports").document("latest").set(report)
    # Also save to history
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    db.collection("aranya_audit_reports").document(ts).set(report)
    print(OK(f"Report saved to Firestore (aranya_audit_reports/latest)"))


# ── Main ──────────────────────────────────────────────────────────────────────
async def main(limit: int = 0, concurrency: int = 3, headless: bool = True):
    print(BOLD(INFO("""
╔══════════════════════════════════════════════╗
║   🎫  ARANYA VIHAARA TICKET AUDIT  🎫        ║
║       Bengaluru Trekkers · BT Ops            ║
╚══════════════════════════════════════════════╝""")))

    creds = load_credentials()
    if not creds:
        print(ERR("No credentials found. Add accounts in BT Ops → Ticket Audit → Accounts."))
        sys.exit(1)

    if limit:
        creds = creds[:limit]
        print(WARN(f"Running limited audit: {len(creds)} accounts"))

    semaphore = asyncio.Semaphore(concurrency)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        print(INFO(f"\nRunning audit on {len(creds)} account(s) with concurrency={concurrency}…\n"))

        tasks = [audit_account(browser, c, semaphore) for c in creds]
        results = await asyncio.gather(*tasks)
        await browser.close()

    report = build_report(list(results))

    # Print summary
    print(BOLD(f"\n{'═'*55}"))
    print(BOLD("AUDIT SUMMARY"))
    print(f"  Accounts audited:  {report['totalAccounts']}")
    print(f"  Successful logins: {report['successAccounts']}")
    print(f"  Failed logins:     {len(report['failedAccounts'])}")
    print(f"  Trek slots found:  {len(report['treks'])}")
    print()

    total_tickets = 0
    for trek in report['treks']:
        print(BOLD(f"  📍 {trek['trekName']} — {trek['date']} ({trek['slot']})"))
        print(f"     District: {trek['district']}")
        print(f"     Accounts: {len(trek['accounts'])}  |  Tickets: {trek['totalTickets']}")
        total_tickets += trek['totalTickets']
        for acc in trek['accounts']:
            print(f"       • {acc['label']} — {acc['visitorCount']} visitor(s) | Ticket: {acc['ticketNo']}")
        print()

    print(BOLD(f"  Total tickets across all treks: {total_tickets}"))

    if report['failedAccounts']:
        print(WARN(f"\n  Failed accounts:"))
        for e in report['failedAccounts']:
            print(f"    • {e}")

    print(BOLD(f"{'═'*55}\n"))

    save_report(report)
    print(OK("Done. Check BT Ops → Ticket Audit for the full report."))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aranya Vihaara Ticket Audit")
    parser.add_argument("--limit",       type=int, default=0,    help="Audit only first N accounts (0 = all)")
    parser.add_argument("--concurrency", type=int, default=3,    help="Max parallel browser sessions (default 3)")
    parser.add_argument("--headed",      action="store_true",    help="Run browser in headed (visible) mode")
    args = parser.parse_args()

    asyncio.run(main(
        limit=args.limit,
        concurrency=args.concurrency,
        headless=not args.headed,
    ))
