# Aranya Vihaara Trek Booker

Admin-only tool for Bengaluru Trekkers ops team.

## First-time setup (run once)

```bash
cd trek-booker
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Create your trekkers Excel

```bash
python create_sample_excel.py   # creates trekkers.xlsx with sample format
```

Fill `trekkers.xlsx` with your trekkers. Columns required:

| Column    | Example             | Notes                              |
|-----------|---------------------|------------------------------------|
| Name      | Ravi Kumar          | First name as on ID                |
| IDType    | Aadhar              | Match site dropdown exactly        |
| IDNumber  | 1234-5678-9012      | As printed on ID                   |
| Age       | 28                  | Number                             |
| Gender    | Male / Female       | Match site dropdown exactly        |
| Mobile    | 9876543210          | 10-digit, no spaces                |

## Book tickets

```bash
source venv/bin/activate
python booker.py
```

**What happens:**
1. Enter email, password, district, trek, date
2. Browser opens — one tab per batch of 3 trekkers
3. Each tab shows CAPTCHA → you type it (takes ~10 sec per tab)
4. All tabs fill trekker details simultaneously (fast)
5. OTP sent to 7795620385 — you enter for each tab
6. All tabs reach payment page simultaneously → tickets on hold
7. Complete payment in each tab
8. PDFs auto-downloaded to current folder

## Watch availability

```bash
source venv/bin/activate
python watcher.py
```

Enter trek, date, how often to check (recommend 300s = 5 min).
WhatsApp alert fires when tickets open.

## Add Peaky Assist WhatsApp API

Edit `watcher.py` top section:
```python
PEAKY_API_URL = "https://..."    # your endpoint
PEAKY_API_KEY = "your-key"
```

## Notes
- Max 3 trekkers per booking (site limit) — script handles batching automatically
- Login credentials: the registered account on aranyavihaara.karnataka.gov.in
- Card details: always entered manually in the browser (never stored)
- Watcher polls every 5 min by default (respectful to govt server)
