"""
Generate vehicle allocation records from hotel_stays data.
Groups by (code, serial) → computes dates, pax → auto-suggests vehicles.
Wipes existing vehicles collection first.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from collections import defaultdict

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate('firebase-admin.json'))

db  = firestore.client()
now = datetime.utcnow().isoformat()

# ── Vehicle config ─────────────────────────────────────────────────────────────
VEHICLE_TYPES = [
    {'type': 'Dzire',        'label': '4-Seater Dzire',   'max': 4},
    {'type': 'Ertiga',       'label': '5-Seater Ertiga',  'max': 5},
    {'type': '12-Seater TT', 'label': '12-Seater TT',     'max': 11},
    {'type': '16-Seater TT', 'label': '16-Seater TT',     'max': 13},
    {'type': '22-Seater TT', 'label': '22-Seater TT',     'max': 17},
]

# ── Route itineraries per package ─────────────────────────────────────────────
PACKAGE_ROUTES = {
    'K': 'Delhi Airport → Haridwar → Guptakashi → Kedarnath → Rishikesh → Delhi Airport',
    'T': 'Delhi Airport → Haridwar → Guptakashi → Kedarnath → Mandal/Chopta → Joshimath-Badrinath → Rishikesh → Delhi Airport',
    'C': 'Delhi Airport → Haridwar → Barkot → Uttarakashi → Guptakashi → Kedarnath → Joshimath-Badrinath → Rishikesh → Delhi Airport',
}

PACKAGE_NAMES = {
    'K': 'Kedarnath 7D',
    'T': 'KBT 9D',
    'C': 'Chardham 11D',
}

# ── Auto-suggest algorithm ─────────────────────────────────────────────────────
def suggest_vehicles(pax):
    """Greedy: fill with largest TTs first, then fill remainder."""
    if pax <= 0:
        return []

    result = defaultdict(int)
    remaining = pax

    # Fill with TT22 (max 17) until remainder fits a single smaller vehicle
    while remaining > 13:
        result['22-Seater TT'] += 1
        remaining -= 17
        if remaining < 0:
            remaining = 0
            break

    if remaining > 11:
        result['16-Seater TT'] += 1
    elif remaining > 5:
        result['12-Seater TT'] += 1
    elif remaining > 4:
        result['Ertiga'] += 1
    elif remaining > 0:
        result['Dzire'] += 1

    # Return in display order (largest first)
    order = ['22-Seater TT', '16-Seater TT', '12-Seater TT', 'Ertiga', 'Dzire']
    return [{'type': t, 'count': result[t]} for t in order if result[t] > 0]

def format_vehicles(vehicles):
    if not vehicles:
        return 'TBD'
    return ' + '.join(f"{v['count']} × {v['type']}" for v in vehicles)

# ── Read hotel_stays and group by (code, serial) ──────────────────────────────
stays = list(db.collection('hotel_stays').stream())
print(f"Read {len(stays)} hotel stay records")

batches = defaultdict(lambda: {'dates': [], 'pax': 0, 'packageName': '', 'code': '', 'serial': 0})
for s in stays:
    d = s.to_dict()
    key = (d['code'], d['serial'])
    batches[key]['code']        = d['code']
    batches[key]['serial']      = d['serial']
    batches[key]['packageName'] = d['packageName']
    batches[key]['pax']         = d['pax']
    batches[key]['dates'].append(d['date'])

print(f"Found {len(batches)} unique batches")

# ── Wipe existing vehicles ─────────────────────────────────────────────────────
v_col = db.collection('vehicles')
existing = list(v_col.stream())
for doc in existing:
    doc.reference.delete()
print(f"Deleted {len(existing)} existing vehicle records")

# ── Create vehicle records ─────────────────────────────────────────────────────
records = []
for (code, serial), batch in sorted(batches.items(), key=lambda x: (x[0][0], x[0][1])):
    dates     = sorted(batch['dates'])
    pax       = batch['pax']
    vehicles  = suggest_vehicles(pax)
    itinerary = PACKAGE_ROUTES.get(code, '')

    record = {
        'batchCode':   f"{code}-{serial}",
        'packageCode': code,
        'packageName': batch['packageName'],
        'serial':      serial,
        'startDate':   dates[0]  if dates else '',
        'endDate':     dates[-1] if dates else '',
        'pax':         pax,
        'vehicles':    vehicles,
        'itinerary':   itinerary,
        'pickupPoint': 'Delhi Airport',
        'dropPoint':   'Delhi Airport',
        'notes':       '',
        'createdAt':   now,
        'updatedAt':   now,
    }
    records.append(record)

for r in records:
    v_col.add(r)
    print(f"  {r['batchCode']:6s}  {r['startDate']} → {r['endDate']}  "
          f"pax={r['pax']:2d}  {format_vehicles(r['vehicles'])}")

print(f"\n✅ Done! {len(records)} vehicle records imported.")
print(f"   K: {sum(1 for r in records if r['packageCode']=='K')} batches")
print(f"   T: {sum(1 for r in records if r['packageCode']=='T')} batches")
print(f"   C: {sum(1 for r in records if r['packageCode']=='C')} batches")
