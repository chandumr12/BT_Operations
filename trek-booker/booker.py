#!/usr/bin/env python3
"""
Aranya Vihaara Trek Ticket Booker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parallel booking: opens multiple tabs for batches of 3 trekkers.
Usage: python booker.py
"""
import asyncio
import sys
import math
from getpass import getpass
from pathlib import Path
import pandas as pd
from playwright.async_api import async_playwright, Page, BrowserContext

BASE_URL      = "https://aranyavihaara.karnataka.gov.in"
MAX_PER_BATCH = 3   # site max per booking
OTP_MOBILE    = "7795620385"

# ── Selectors (adjust if site changes) ──────────────────────────────────────
SEL = {
    # Login page
    "email"          : 'input[type="email"]',
    "password"       : 'input[type="password"]',
    "captcha_input"  : 'input[placeholder="Enter Captcha"]',
    "login_submit"   : 'button[type="submit"]',

    # Trek/date selection (home page)
    "district_sel"   : 'select[name*="district"], select[id*="district"]',
    "trek_sel"       : 'select[name*="trek"], select[id*="trek"]',
    "date_input"     : 'input[type="date"]',
    "proceed_btn"    : 'button[type="submit"], input[type="submit"]',

    # Trekker form fields (nth-indexed)
    "name_input"     : 'input[placeholder="ಮೊದಲ ಹೆಸರು"]',
    "idtype_sel"     : 'select[name*="id_type"], select[id*="id_type"]',
    "idnum_input"    : 'input[placeholder="ಸರ್ಕಾರಿ ಐಡಿ ನಂ."]',
    "age_input"      : 'input[placeholder="ವಯಸ್ಸು"]',
    "gender_sel"     : 'select[name*="gender"], select[id*="gender"]',
    "mobile_input"   : 'input[placeholder="ಮೊಬೈಲ್ ಸಂಖ್ಯೆ"]',

    # Add-trekker button and OTP
    "add_btn"        : 'button:has-text("+ ಸಂದರ್ಶಕರನ್ನು ಸೇರಿಸಿ")',
    "send_otp_btn"   : 'button:has-text("OTP ಪಡೆಯಿರಿ")',
    "otp_input"      : 'input[name*="otp"], input[id*="otp"], input[maxlength="6"]',
    "verify_otp_btn" : 'button:has-text("Verify"), button:has-text("ದೃಢೀಕರಿಸಿ")',

    # After payment
    "download_btn"   : 'a:has-text("Download"), a[href*=".pdf"], button:has-text("Download Ticket")',
}

# ── Colours for terminal ─────────────────────────────────────────────────────
def clr(text, code): return f"\033[{code}m{text}\033[0m"
GREEN  = lambda t: clr(t, "92")
YELLOW = lambda t: clr(t, "93")
RED    = lambda t: clr(t, "91")
CYAN   = lambda t: clr(t, "96")
BOLD   = lambda t: clr(t, "1")

def banner():
    print(BOLD(CYAN("""
╔══════════════════════════════════════════╗
║   🏔  ARANYA VIHAARA TREK BOOKER  🏔     ║
║      Bengaluru Trekkers · Auto Mode      ║
╚══════════════════════════════════════════╝""")))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 – Login (sequential, needs CAPTCHA per context)
# ─────────────────────────────────────────────────────────────────────────────
async def do_login(page: Page, email: str, password: str, batch_num: int) -> bool:
    # Try homepage first — login may be a modal/redirect
    await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_timeout(1500)

    # If login form not immediately visible, click the Login link
    try:
        await page.locator('input[type="email"]').wait_for(timeout=3000)
    except Exception:
        for txt in ["Login", "Sign In", "ಲಾಗಿನ್", "ಲಾಗಿನ"]:
            btn = page.locator(f'a:has-text("{txt}"), button:has-text("{txt}")')
            if await btn.count() > 0:
                await btn.first.click()
                await page.wait_for_timeout(1500)
                break

    await page.fill(SEL["email"],    email)
    await page.fill(SEL["password"], password)

    # CAPTCHA — user reads from browser window and types here
    print(YELLOW(f"\n⚠  Tab {batch_num}: CAPTCHA needed → check browser window"))
    captcha = input(f"   Tab {batch_num} CAPTCHA text: ").strip()
    await page.fill(SEL["captcha_input"], captcha)
    await page.click(SEL["login_submit"])
    await page.wait_for_load_state("networkidle", timeout=20000)

    if "/login" in page.url or "login" in page.url.lower():
        print(RED(f"✗ Tab {batch_num}: login failed (wrong captcha / creds?)"))
        retry = input("  Retry? (y/n): ").strip().lower()
        if retry == "y":
            return await do_login(page, email, password, batch_num)
        return False

    print(GREEN(f"✓ Tab {batch_num}: logged in"))
    return True


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 – Select trek / date (runs in parallel across all tabs)
# ─────────────────────────────────────────────────────────────────────────────
async def select_trek_date(page: Page, district: str, trek: str, date_iso: str, batch_num: int):
    """Navigate home, pick district → trek → date → proceed."""
    print(f"  Tab {batch_num}: selecting trek…")
    await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)

    # District
    try:
        await page.select_option(SEL["district_sel"], label=district, timeout=5000)
        await page.wait_for_timeout(600)
    except Exception:
        print(YELLOW(f"  Tab {batch_num}: district selector not found — may already be on booking page"))

    # Trek
    try:
        await page.select_option(SEL["trek_sel"], label=trek, timeout=5000)
        await page.wait_for_timeout(600)
    except Exception:
        print(YELLOW(f"  Tab {batch_num}: trek selector not found — check selector"))

    # Date (YYYY-MM-DD)
    try:
        await page.fill(SEL["date_input"], date_iso, timeout=5000)
        await page.wait_for_timeout(300)
    except Exception:
        print(YELLOW(f"  Tab {batch_num}: date field not found"))

    # Proceed
    await page.click(SEL["proceed_btn"], timeout=10000)
    await page.wait_for_load_state("networkidle", timeout=20000)
    print(GREEN(f"  Tab {batch_num}: on trekker-fill page"))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 – Fill trekker rows (parallel)
# ─────────────────────────────────────────────────────────────────────────────
async def fill_one_row(page: Page, idx: int, t: dict):
    """Fill one trekker row at 0-based index `idx`."""
    # If adding row 1+ click the Add button first
    if idx > 0:
        add = page.locator(SEL["add_btn"])
        await add.click(timeout=8000)
        await page.wait_for_timeout(400)

    await page.locator(SEL["name_input"]).nth(idx).fill(str(t["Name"]))
    await page.wait_for_timeout(100)

    # ID Type dropdown
    try:
        await page.locator(SEL["idtype_sel"]).nth(idx).select_option(
            label=str(t["IDType"]), timeout=4000
        )
    except Exception:
        # Try by value if label fails
        await page.locator(SEL["idtype_sel"]).nth(idx).select_option(
            value=str(t["IDType"]), timeout=4000
        )

    await page.locator(SEL["idnum_input"]).nth(idx).fill(str(t["IDNumber"]))
    await page.locator(SEL["age_input"]).nth(idx).fill(str(int(t["Age"])))

    # Gender
    try:
        await page.locator(SEL["gender_sel"]).nth(idx).select_option(
            label=str(t["Gender"]), timeout=4000
        )
    except Exception:
        await page.locator(SEL["gender_sel"]).nth(idx).select_option(
            value=str(t["Gender"]), timeout=4000
        )

    await page.locator(SEL["mobile_input"]).nth(idx).fill(str(t["Mobile"]))


async def fill_batch(page: Page, trekkers: list, batch_num: int):
    print(f"  Tab {batch_num}: filling {len(trekkers)} trekker(s)…")
    for i, t in enumerate(trekkers):
        await fill_one_row(page, i, t)
        await page.wait_for_timeout(200)
    print(GREEN(f"  Tab {batch_num}: trekker details filled ✓"))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 – OTP (sequential: request → enter → verify per tab)
# ─────────────────────────────────────────────────────────────────────────────
async def handle_otp(page: Page, batch_num: int):
    print(f"\n  Tab {batch_num}: sending OTP to {OTP_MOBILE}…")
    await page.click(SEL["send_otp_btn"], timeout=10000)
    await page.wait_for_timeout(2000)

    otp = input(YELLOW(f"  📱 OTP for Tab {batch_num} (check SMS on {OTP_MOBILE}): ")).strip()
    await page.fill(SEL["otp_input"], otp, timeout=8000)
    await page.click(SEL["verify_otp_btn"], timeout=8000)
    await page.wait_for_load_state("networkidle", timeout=20000)
    print(GREEN(f"  Tab {batch_num}: OTP verified ✓"))


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 – Payment + PDF download
# ─────────────────────────────────────────────────────────────────────────────
async def download_pdf(page: Page, batch_num: int, date_iso: str):
    try:
        dl_loc = page.locator(SEL["download_btn"])
        if await dl_loc.count() > 0:
            async with page.expect_download(timeout=30000) as dl_info:
                await dl_loc.first.click()
            dl = await dl_info.value
            fname = f"ticket_batch{batch_num}_{date_iso}.pdf"
            await dl.save_as(fname)
            print(GREEN(f"  Tab {batch_num}: ticket saved → {fname}"))
        else:
            print(YELLOW(f"  Tab {batch_num}: no auto-download found — save manually from browser"))
    except Exception as e:
        print(YELLOW(f"  Tab {batch_num}: PDF download error ({e}) — save manually"))


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
async def main():
    banner()

    # ── Gather inputs ────────────────────────────────────────────────────────
    print(BOLD("\n── Login ─────────────────────────────────"))
    email    = input("Email        : ").strip()
    password = getpass("Password     : ")

    print(BOLD("\n── Trek ──────────────────────────────────"))
    district = input("District     : ").strip()
    trek     = input("Trek name    : ").strip()
    date_iso = input("Date (YYYY-MM-DD): ").strip()

    print(BOLD("\n── Trekkers file ────────────────────────"))
    xl_path = input("Excel path [trekkers.xlsx]: ").strip() or "trekkers.xlsx"
    if not Path(xl_path).exists():
        print(RED(f"✗ File not found: {xl_path}"))
        sys.exit(1)

    # ── Load Excel ───────────────────────────────────────────────────────────
    df       = pd.read_excel(xl_path)
    required = ["Name", "IDType", "IDNumber", "Age", "Gender", "Mobile"]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        print(RED(f"✗ Excel missing columns: {missing}"))
        print(f"  Required: {required}")
        sys.exit(1)

    trekkers = df[required].to_dict("records")
    batches  = [trekkers[i:i+MAX_PER_BATCH] for i in range(0, len(trekkers), MAX_PER_BATCH)]
    n        = len(batches)

    print(GREEN(f"\n✓ {len(trekkers)} trekkers → {n} parallel booking(s) of ≤{MAX_PER_BATCH}"))
    names_list = [f"  Batch {i+1}: {[t['Name'] for t in b]}" for i, b in enumerate(batches)]
    print("\n".join(names_list))
    input("\nPress Enter to open browser(s) and start… ")

    # ── Run automation ───────────────────────────────────────────────────────
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, slow_mo=60)

        # Create N separate contexts (independent sessions)
        contexts = [await browser.new_context() for _ in range(n)]
        pages    = [await ctx.new_page() for ctx in contexts]

        # ── Login each tab sequentially (needs CAPTCHA per tab) ──────────────
        print(BOLD(f"\n── Step 1/4: Login ({n} tabs) ────────────"))
        for i, pg in enumerate(pages):
            ok = await do_login(pg, email, password, i + 1)
            if not ok:
                print(RED("Aborting."))
                await browser.close()
                return

        # ── Select trek in all tabs simultaneously ───────────────────────────
        print(BOLD(f"\n── Step 2/4: Trek selection (parallel) ───"))
        await asyncio.gather(*[
            select_trek_date(pages[i], district, trek, date_iso, i + 1)
            for i in range(n)
        ])

        # ── Fill trekker details in all tabs simultaneously ──────────────────
        print(BOLD(f"\n── Step 3/4: Fill trekker details (parallel) ──"))
        await asyncio.gather(*[
            fill_batch(pages[i], batches[i], i + 1)
            for i in range(n)
        ])

        # ── OTP per tab (sequential: each sends OTP, user enters) ────────────
        print(BOLD(f"\n── Step 4/4: OTP verification ─────────────"))
        for i, pg in enumerate(pages):
            await handle_otp(pg, i + 1)

        # ── All tabs now on payment page ─────────────────────────────────────
        print(BOLD(CYAN(f"""
╔═══════════════════════════════════════════╗
║  💳  ALL {n} TAB(S) ARE ON PAYMENT PAGE   ║
║  Complete payment in EACH browser tab.    ║
║  Tickets are on hold — act fast!          ║
╚═══════════════════════════════════════════╝""")))
        input("\nPress Enter HERE after ALL payments are done… ")

        # ── Download PDFs ─────────────────────────────────────────────────────
        print(BOLD("\n── Downloading tickets ────────────────────"))
        await asyncio.gather(*[
            download_pdf(pages[i], i + 1, date_iso)
            for i in range(n)
        ])

        print(GREEN("\n✓ All done! Check the current folder for PDF tickets."))
        input("\nPress Enter to close browsers… ")
        await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nCancelled.")
