"""Fetch reference page and CAMDP epics from Jira."""
import json
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
config = dotenv_values(ROOT / ".env")

# 1. Fetch reference page
print("=== Fetching reference page ===")
try:
    r = requests.get(
        "https://gecgithub01.walmart.com/pages/l0c0k21/presentacion-fabrica/",
        timeout=10,
    )
    print(f"Status: {r.status_code}, Length: {len(r.text)}")
    (ROOT / "data" / "reference_page.html").write_text(r.text, encoding="utf-8")
    print("Saved to data/reference_page.html")
except Exception as e:
    print(f"Could not fetch reference: {e}")

# 2. Fetch CAMDP epics from Jira
print("\n=== Fetching CAMDP epics from Jira ===")
session = requests.Session()
session.headers["Cookie"] = config.get("JIRA_COOKIE", "")

# Search for epics in CAMDP project
jql = "project = CAMDP AND issuetype = Epic ORDER BY created DESC"
url = f"{config['JIRA_URL'].rstrip('/')}/rest/api/2/search"
params = {
    "jql": jql,
    "maxResults": 100,
    "fields": "summary,status,assignee,created,updated,priority,labels,customfield_10006,description,resolution,resolutiondate,components",
}

r = session.get(url, params=params, timeout=30)
print(f"Status: {r.status_code}")

if r.status_code == 200:
    data = r.json()
    print(f"Total epics found: {data.get('total', 0)}")
    # Save raw response
    (ROOT / "data" / "epics_raw.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("Saved to data/epics_raw.json")
    # Print summary
    for issue in data.get("issues", []):
        key = issue["key"]
        summary = issue["fields"]["summary"]
        status = issue["fields"]["status"]["name"]
        print(f"  {key}: [{status}] {summary}")
else:
    print(f"Error: {r.status_code}")
    print(r.text[:500])
