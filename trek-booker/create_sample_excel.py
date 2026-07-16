"""Run once: python create_sample_excel.py  → creates trekkers.xlsx"""
import pandas as pd

sample = [
    # Name            IDType    IDNumber        Age  Gender  Mobile
    {"Name": "Ravi Kumar",     "IDType": "Aadhar", "IDNumber": "1234-5678-9012", "Age": 28, "Gender": "Male",   "Mobile": "9876543210"},
    {"Name": "Priya Sharma",   "IDType": "Aadhar", "IDNumber": "9876-5432-1098", "Age": 25, "Gender": "Female", "Mobile": "9876543211"},
    {"Name": "Suresh B",       "IDType": "PAN",    "IDNumber": "ABCDE1234F",     "Age": 32, "Gender": "Male",   "Mobile": "9876543212"},
    {"Name": "Ananya Nair",    "IDType": "Aadhar", "IDNumber": "2345-6789-0123", "Age": 27, "Gender": "Female", "Mobile": "9876543213"},
    {"Name": "Kiran Rao",      "IDType": "Aadhar", "IDNumber": "3456-7890-1234", "Age": 30, "Gender": "Male",   "Mobile": "9876543214"},
    {"Name": "Deepika M",      "IDType": "Voter",  "IDNumber": "KA/12/345/678",  "Age": 24, "Gender": "Female", "Mobile": "9876543215"},
]

df = pd.DataFrame(sample)
df.to_excel("trekkers.xlsx", index=False)
print(f"✓ Created trekkers.xlsx with {len(sample)} rows")
print("\nColumns: Name | IDType | IDNumber | Age | Gender | Mobile")
print("\nIDType options (check site dropdown):")
print("  Aadhar / PAN / Voter / Passport / Driving License")
print("\nGender options: Male / Female")
