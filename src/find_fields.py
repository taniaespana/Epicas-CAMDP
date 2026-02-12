"""Find Jira field IDs for PlannedDoneDate, StartDate, DueDate."""
import sys
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
config = dotenv_values(ROOT / ".env")

session = requests.Session()
if config.get("JIRA_EMAIL") and config.get("JIRA_TOKEN"):
    session.auth = (config["JIRA_EMAIL"], config["JIRA_TOKEN"])
elif config.get("JIRA_COOKIE"):
    session.headers["Cookie"] = config["JIRA_COOKIE"]

url = f"{config['JIRA_URL'].rstrip('/')}/rest/api/2/field"
r = session.get(url, timeout=15)
if r.status_code != 200:
    sys.exit(f"Error {r.status_code}")

fields = r.json()
keywords = ["planned", "done", "date", "start", "due", "end", "finish"]
for f in fields:
    name_lower = f["name"].lower()
    if any(k in name_lower for k in keywords):
        print(f"  {f['id']:30s} | {f['name']}")
