"""
Import hotel stays from PDF data (v2 — correct per-batch serial scheme).
Deletes existing data first then re-imports.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate('firebase-admin.json'))

db   = firestore.client()
now  = datetime.utcnow().isoformat()
col  = db.collection('hotel_stays')

# ── helpers ───────────────────────────────────────────────────────────────────
def d(m, day, yr=2026):
    months = {'Apr':4,'May':5,'Jun':6,'Jul':7}
    return f"{yr}-{months[m]:02d}-{day:02d}"

def rec(place, date, serial, code, pkg, pax, status, ds=0):
    return dict(place=place, date=date, serial=serial, code=code,
                packageName=pkg, pax=pax, status=status,
                doubleSharing=ds, clientNames=[], createdAt=now, updatedAt=now)

# ── wipe existing ─────────────────────────────────────────────────────────────
docs = list(col.stream())
for doc in docs:
    doc.reference.delete()
print(f"Deleted {len(docs)} old records")

records = []

# ═══════════════════════════════════════════════════════════════════════════════
# KEDARNATH 7D  (code=K)
# Places: Haridwar(1N), Guptakashi(2N=CI+CO), Kedarnath(1N), Rishikesh(1N)
# ═══════════════════════════════════════════════════════════════════════════════
K = 'Kedarnath 7D'
K_DATA = [
    # sl, pax, haridwar, gupta_ci, gupta_co, kedarnath, rishikesh
    (1, 17, d('Apr',27), d('Apr',28), d('Apr',30), d('Apr',29), d('May', 1)),
    (2, 21, d('May', 1), d('May', 2), d('May', 4), d('May', 3), d('May', 5)),
    (3, 22, d('May', 3), d('May', 4), d('May', 6), d('May', 5), d('May', 7)),
    (4, 10, d('May',10), d('May',11), d('May',13), d('May',12), d('May',14)),
    (5,  7, d('May',18), d('May',19), d('May',21), d('May',20), d('May',22)),
    (6, 13, d('May',25), d('May',26), d('May',28), d('May',27), d('May',29)),
    (7, 19, d('May',30), d('May',31), d('Jun', 2), d('Jun', 1), d('Jun', 3)),
    (8,  4, d('Jun', 8), d('Jun', 9), d('Jun',11), d('Jun',10), d('Jun',12)),
    (9,  6, d('Jun',14), d('Jun',15), d('Jun',17), d('Jun',16), d('Jun',18)),
    (10, 0, d('Jun',21), d('Jun',22), d('Jun',24), d('Jun',23), d('Jun',25)),
    (11, 0, d('Jun',29), d('Jun',30), d('Jul', 2), d('Jul', 1), d('Jul', 3)),
]
for sl, pax, hw, g_ci, g_co, kd, rk in K_DATA:
    records += [
        rec('Haridwar',          hw,   sl, 'K', K, pax, '1N'),
        rec('Guptakashi',        g_ci, sl, 'K', K, pax, 'CHECK-IN'),
        rec('Guptakashi',        g_co, sl, 'K', K, pax, 'CHECK-OUT'),
        rec('Kedarnath',         kd,   sl, 'K', K, pax, '1N'),
        rec('Rishikesh',         rk,   sl, 'K', K, pax, '1N'),
    ]

# ═══════════════════════════════════════════════════════════════════════════════
# KBT 9D  (code=T)
# Places: Haridwar(1N), Guptakashi(2N), Kedarnath(1N),
#         Mandal/Chopta(1N), Joshimath-Badrinath(1N), Rishikesh(1N)
# ═══════════════════════════════════════════════════════════════════════════════
T = 'KBT 9D'
# None = NA (no stay at that place for that batch)
T_DATA = [
    # sl, pax, hw,          g_ci,        g_co,        kd,          mandal,      joshi,       rk
    (1, 16, d('Apr',25), d('Apr',26), d('Apr',28), d('Apr',27), d('Apr',29), d('Apr',30), d('May', 1)),
    (2, 15, None,         d('Apr',28), d('Apr',30), d('Apr',29), None,         d('May', 1), d('May', 2)),  # CBT
    (3, 16, d('May', 1), d('May', 2), d('May', 4), d('May', 3), d('May', 5), d('May', 6), d('May', 7)),
    (4, 16, d('May', 1), d('May', 2), d('May', 4), d('May', 3), d('May', 5), d('May', 6), d('May', 7)),
    (5, 21, d('May', 2), d('May', 3), d('May', 5), d('May', 4), d('May', 6), d('May', 7), d('May', 8)),
    (6,  3, d('May', 9), d('May',10), d('May',12), d('May',11), d('May',13), d('May',14), d('May',15)),
    (7, 17, d('May',15), d('May',16), d('May',18), d('May',17), d('May',19), d('May',20), d('May',21)),
    (8, 16, d('May',22), d('May',23), d('May',25), d('May',24), d('May',26), d('May',27), d('May',28)),
    (9, 16, d('May',23), d('May',24), d('May',26), d('May',25), d('May',27), d('May',28), d('May',29)),
    (10,12, d('May',30), d('May',31), d('Jun', 2), d('Jun', 1), d('Jun', 3), d('Jun', 4), d('Jun', 5)),
    (11, 3, d('Jun', 6), d('Jun', 7), d('Jun', 9), d('Jun', 8), d('Jun',10), d('Jun',11), d('Jun',12)),
    (12, 0, d('Jun',12), d('Jun',13), d('Jun',15), d('Jun',14), d('Jun',16), d('Jun',17), d('Jun',18)),
    (13, 0, d('Jun',20), d('Jun',21), d('Jun',23), d('Jun',22), d('Jun',24), d('Jun',25), d('Jun',26)),
]
for sl, pax, hw, g_ci, g_co, kd, mandal, joshi, rk in T_DATA:
    if hw:
        records.append(rec('Haridwar',            hw,     sl, 'T', T, pax, '1N'))
    records.append(rec('Guptakashi',              g_ci,   sl, 'T', T, pax, 'CHECK-IN'))
    records.append(rec('Guptakashi',              g_co,   sl, 'T', T, pax, 'CHECK-OUT'))
    records.append(rec('Kedarnath',               kd,     sl, 'T', T, pax, '1N'))
    if mandal:
        records.append(rec('Mandal/Chopta',       mandal, sl, 'T', T, pax, '1N'))
    records.append(rec('Joshimath-Badrinath',     joshi,  sl, 'T', T, pax, '1N'))
    records.append(rec('Rishikesh',               rk,     sl, 'T', T, pax, '1N'))

# ═══════════════════════════════════════════════════════════════════════════════
# CHARDHAM 11D  (code=C)
# Places: Haridwar(1N), Barkot(2N), Uttarakashi(2N), Guptakashi(2N),
#         Kedarnath(1N), Joshimath-Badrinath(1N), Rishikesh(1N)
# ═══════════════════════════════════════════════════════════════════════════════
C = 'Chardham 11D'
C_DATA = [
    # sl,pax, hw,          b_ci,        b_co,        u_ci,        u_co,        g_ci,        g_co,        kd,          badri,       rk
    (1,  4, None,         d('Apr',20), d('Apr',21), d('Apr',22), None,         d('Apr',23), d('Apr',25), d('Apr',24), d('Apr',26), d('Apr',27)),
    (2, 16, d('Apr',25), d('Apr',26), d('Apr',27), d('Apr',28), d('Apr',29), d('Apr',30), d('May', 2), d('May', 1), d('May', 3), d('May', 4)),
    (3, 17, d('Apr',25), d('Apr',26), d('Apr',27), d('Apr',28), d('Apr',29), d('Apr',30), d('May', 2), d('May', 1), d('May', 3), d('May', 4)),
    (4, 16, d('Apr',30), d('May', 1), d('May', 2), d('May', 3), d('May', 4), d('May', 5), d('May', 7), d('May', 6), d('May', 8), d('May', 9)),
    (5, 15, d('May', 1), d('May', 2), d('May', 3), d('May', 4), d('May', 5), d('May', 6), d('May', 8), d('May', 7), d('May', 9), d('May',10)),
    (6, 16, d('May', 8), d('May', 9), d('May',10), d('May',11), d('May',12), d('May',13), d('May',15), d('May',14), d('May',16), d('May',17)),
    (7,  9, d('May',14), d('May',15), d('May',16), d('May',17), d('May',18), d('May',19), d('May',21), d('May',20), d('May',22), d('May',23)),
    (8, 19, d('May',16), d('May',17), d('May',18), d('May',19), d('May',20), d('May',21), d('May',23), d('May',22), d('May',24), d('May',25)),
    (9,  2, d('May',20), d('May',21), d('May',22), d('May',23), d('May',24), d('May',25), d('May',27), d('May',26), d('May',28), d('May',29)),
    (10,11, d('May',30), d('May',31), d('Jun', 1), d('Jun', 2), d('Jun', 3), d('Jun', 4), d('Jun', 6), d('Jun', 5), d('Jun', 7), d('Jun', 8)),
    (11, 0, d('Jun', 6), d('Jun', 7), d('Jun', 8), d('Jun', 9), d('Jun',10), d('Jun',11), d('Jun',13), d('Jun',12), d('Jun',14), d('Jun',15)),
    (12, 4, d('Jun',13), d('Jun',14), d('Jun',15), d('Jun',16), d('Jun',17), d('Jun',18), d('Jun',20), d('Jun',19), d('Jun',21), d('Jun',22)),
    (13, 0, d('Jun',20), d('Jun',21), d('Jun',22), d('Jun',23), d('Jun',24), d('Jun',25), d('Jun',27), d('Jun',26), d('Jun',28), d('Jun',29)),
]
for sl, pax, hw, b_ci, b_co, u_ci, u_co, g_ci, g_co, kd, badri, rk in C_DATA:
    if hw: records.append(rec('Haridwar', hw, sl, 'C', C, pax, '1N'))
    records.append(rec('Barkot', b_ci, sl, 'C', C, pax, 'CHECK-IN'))
    records.append(rec('Barkot', b_co, sl, 'C', C, pax, 'CHECK-OUT'))
    # Uttarakashi: if no CO date treat as 1N
    if u_co:
        records.append(rec('Uttarakashi', u_ci, sl, 'C', C, pax, 'CHECK-IN'))
        records.append(rec('Uttarakashi', u_co, sl, 'C', C, pax, 'CHECK-OUT'))
    else:
        records.append(rec('Uttarakashi', u_ci, sl, 'C', C, pax, '1N'))
    records.append(rec('Guptakashi', g_ci, sl, 'C', C, pax, 'CHECK-IN'))
    records.append(rec('Guptakashi', g_co, sl, 'C', C, pax, 'CHECK-OUT'))
    records.append(rec('Kedarnath',  kd,   sl, 'C', C, pax, '1N'))
    records.append(rec('Joshimath-Badrinath', badri, sl, 'C', C, pax, '1N'))
    records.append(rec('Rishikesh',  rk,   sl, 'C', C, pax, '1N'))

# ── write to Firestore ────────────────────────────────────────────────────────
print(f"Importing {len(records)} records...")
for i, r in enumerate(records):
    col.add(r)
    if (i+1) % 50 == 0:
        print(f"  {i+1}/{len(records)}")

print(f"\n✅ Done! {len(records)} records imported.")
print(f"   K batches: 11  ({sum(1 for r in records if r['code']=='K' and r['status']=='1N' and r['place']=='Haridwar') + sum(1 for r in records if r['code']=='K' and r['status']=='CHECK-IN' and r['place']=='Guptakashi')} place-entries... first place)")
print(f"   T batches: 13")
print(f"   C batches: 13")
