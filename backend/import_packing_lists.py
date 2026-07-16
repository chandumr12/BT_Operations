"""
Import 3 packing list categories from trek reference:
  - Monsoon Treks
  - Autumn Treks
  - Spring Treks
Deletes any existing packing_lists docs first, then re-imports.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import random
import string

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate('firebase-admin.json'))

db  = firestore.client()
col = db.collection('packing_lists')
now = datetime.utcnow().isoformat()

def gid():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))

def item(name, emoji, qty='', optional=False, rentable=False):
    return dict(id=gid(), name=name, emoji=emoji, quantity=qty,
                optional=optional, rentable=rentable)

def section(name, icon, items):
    return dict(id=gid(), name=name, icon=icon, items=items)

# ── Shared sections ────────────────────────────────────────────────────────────

def gear_section():
    return section('Trek Gear & Accessories', '🎒', [
        item('Trekking Poles',          '🎿', '2 nos',        optional=True,  rentable=True),
        item('Headlamp',                '🔦', '1 nos'),
        item('Thermos',                 '🍵', '1 nos'),
        item('Water Bottle',            '💧', '1 L'),
        item('Backpack',                '🎒', '55+10 L',      rentable=True),
        item('Sunglasses',              '🕶️', '1 pair'),
        item('Sun Cap',                 '🧢', '1 nos'),
        item('Power Bank',              '🔋', '10000 mAh'),
        item('Day Pack',                '🎒', '1 nos',        optional=True,  rentable=True),
        item('Rain Cover for Backpack', '☂️', '1 nos'),
        item('Lunch Box',               '🍱', '1 nos'),
        item('Spoon and Mug',           '🥄', '1 set'),
        item('Trekking Shoes',          '🥾', 'High ankle'),
    ])

def toiletries_section():
    return section('Toiletries', '🧴', [
        item('Toilet Paper',            '🧻', '2 rolls'),
        item('Toothbrush & Toothpaste', '🦷', '1 set'),
        item('Lip Balm & Sunscreen',    '🌞', '1 each'),
        item('Menstrual Products',      '🩸', 'As needed',    optional=True),
        item('Zip Lock Pouch',          '📦', '2 nos'),
        item('Light Hand Towel',        '🧴', '1 nos'),
        item('Reusable Plastic Bag',    '🛍️', '2 nos'),
    ])

def medicines_section():
    return section('Medicines', '💊', [
        item('Diamox',                  '💊', '1 strip'),
        item('Paracetamol',             '💊', '1 strip'),
        item('Avomine',                 '💊', '1 strip'),
        item('Digene',                  '💊', '1 strip'),
        item('ORS Packets',             '🧃', '6 packs'),
        item('Muscle Relaxant Spray',   '💉', '1 nos'),
        item('Knee Cap',                '🦵', '1 pair',       optional=True),
        item('Personal Medication',     '💊', 'As prescribed', optional=True),
    ])

def documents_section():
    return section('Documents', '📋', [
        item('Medical Form (MBBS signed)',  '📋', '1 copy'),
        item('Disclaimer Form',             '📝', '1 copy'),
        item('ID Proof (original + copy)',  '🪪', '1 set'),
        item('Vaccination Certificate',     '💉', '1 copy'),
    ])

# ── Season-specific Clothes sections ──────────────────────────────────────────

def clothes_monsoon():
    return section('Clothes & Layers', '🧥', [
        item('Light Sweater',               '👕', '1 nos'),
        item('Fleece Jacket',               '🧥', '1 nos'),
        item('Full Arm Dry Fit Shirts',     '👕', '3 pairs'),
        item('Padded Jacket',               '🧥', '1 nos'),
        item('Dry Fit Trek Pants',          '👖', '3 pairs'),
        item('Woollen Gloves',              '🧤', '1 pair'),
        item('Undergarments',               '👙', '3 pairs'),
        item('Woollen Socks',               '🧦', '3 pairs'),
        item('Woollen Cap',                 '🧢', '1 nos'),
        item('Poncho / Rain Jacket & Pant', '🌧️', '1 set'),
        item('Waterproof Gloves',           '🧤', '1 pair'),
        item('Synthetic Socks',             '🧦', '2 pairs'),
        item('Balaclava / Scarf',           '🧣', '1 nos'),
        item('Slippers',                    '🩴', '1 pair'),
    ])

def clothes_autumn():
    return section('Clothes & Layers', '🧥', [
        item('Light Sweater',                   '👕', '1 nos'),
        item('Fleece Jacket',                   '🧥', '1 nos'),
        item('Full Arm Dry Fit Shirts',         '👕', '3 pairs'),
        item('Padded Jacket',                   '🧥', '1 nos'),
        item('Dry Fit Trek Pants',              '👖', '3 pairs'),
        item('Woollen Gloves',                  '🧤', '1 pair'),
        item('Undergarments',                   '👙', '3 pairs'),
        item('Woollen Socks',                   '🧦', '3 pairs'),
        item('Woollen Cap',                     '🧢', '1 nos'),
        item('Poncho / Windproof Jacket & Pant','🌬️', '1 set'),
        item('Waterproof Gloves',               '🧤', '1 pair'),
        item('Synthetic Socks',                 '🧦', '2 pairs'),
        item('Balaclava / Scarf',               '🧣', '1 nos'),
        item('Slippers',                        '🩴', '1 pair'),
    ])

def clothes_spring():
    return section('Clothes & Layers', '🧥', [
        item('Light Sweater',                   '👕', '1 nos'),
        item('Fleece Jacket',                   '🧥', '1 nos'),
        item('Full Arm Dry Fit Shirts',         '👕', '3 pairs'),
        item('Padded Jacket',                   '🧥', '1 nos'),
        item('Dry Fit Trek Pants',              '👖', '3 pairs'),
        item('Woollen Gloves',                  '🧤', '1 pair'),
        item('Undergarments',                   '👙', '3 pairs'),
        item('Woollen Socks',                   '🧦', '3 pairs'),
        item('Woollen Cap',                     '🧢', '1 nos'),
        item('Poncho / Windproof Jacket & Pant','🌤️', '1 set'),
        item('Waterproof Gloves',               '🧤', '1 pair'),
        item('Synthetic Socks',                 '🧦', '2 pairs'),
        item('Balaclava / Scarf',               '🧣', '1 nos'),
        item('Slippers',                        '🩴', '1 pair'),
    ])

# ── Category definitions ───────────────────────────────────────────────────────
CATEGORIES = [
    {
        'name':        'Monsoon Treks',
        'emoji':       '🌧️',
        'slug':        'monsoon-treks',
        'description': 'Packing list for treks during the monsoon season',
        'sections':    [gear_section(), clothes_monsoon(), toiletries_section(), medicines_section(), documents_section()],
    },
    {
        'name':        'Autumn Treks',
        'emoji':       '🍂',
        'slug':        'autumn-treks',
        'description': 'Packing list for treks during the autumn season',
        'sections':    [gear_section(), clothes_autumn(), toiletries_section(), medicines_section(), documents_section()],
    },
    {
        'name':        'Spring Treks',
        'emoji':       '🌸',
        'slug':        'spring-treks',
        'description': 'Packing list for treks during the spring season',
        'sections':    [gear_section(), clothes_spring(), toiletries_section(), medicines_section(), documents_section()],
    },
]

# ── Wipe existing ──────────────────────────────────────────────────────────────
docs = list(col.stream())
for doc in docs:
    doc.reference.delete()
print(f"Deleted {len(docs)} existing packing list records")

# ── Import ─────────────────────────────────────────────────────────────────────
for cat in CATEGORIES:
    col.add({**cat, 'createdAt': now, 'updatedAt': now})
    total_items = sum(len(s['items']) for s in cat['sections'])
    print(f"  ✅ {cat['emoji']} {cat['name']} — {len(cat['sections'])} sections, {total_items} items")

print(f"\n✅ Done! {len(CATEGORIES)} packing lists imported.")
print(f"   Public URLs:")
for cat in CATEGORIES:
    print(f"   /packing/{cat['slug']}")
