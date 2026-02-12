"""Find the Epic Link custom field name in Jira."""
from dotenv import dotenv_values
import requests

config = dotenv_values(".env")
s = requests.Session()
s.headers["Cookie"] = config["JIRA_COOKIE"]
url = config["JIRA_URL"] + "/rest/api/2/search"

# Get a Story with all fields
r = s.get(url, params={
    "jql": "project=CAMDP AND issuetype=Story ORDER BY updated DESC",
    "maxResults": "1", "fields": "*all",
}, timeout=20)
print("Status:", r.status_code)
d = r.json()
if "issues" not in d or not d["issues"]:
    print("No issues found", d.get("errorMessages", ""))
    exit(1)

i = d["issues"][0]
f = i["fields"]
print(f"Key: {i['key']}")
print(f"parent: {f.get('parent')}")

# Search all fields for CAMDP- references
for k, v in sorted(f.items()):
    if v is None:
        continue
    s_val = str(v)
    if "CAMDP-" in s_val:
        print(f"  MATCH {k}: {s_val[:120]}")

# Also check the field API for epic-related fields
print("\n--- Checking /rest/api/2/field for epic ---")
r2 = s.get(config["JIRA_URL"] + "/rest/api/2/field", timeout=15)
if r2.status_code == 200:
    for field in r2.json():
        name = field.get("name", "").lower()
        fid = field.get("id", "")
        if "epic" in name:
            print(f"  {fid}: {field['name']}")
