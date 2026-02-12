"""Extrae TODAS las épicas CAMDP de Jira (con paginación).

Guarda los datos limpios en data/epics.json.
"""

import json
import sys
from pathlib import Path

import requests
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
config = dotenv_values(ROOT / ".env")


def build_session() -> requests.Session:
    """Sesion autenticada contra Jira."""
    session = requests.Session()
    if config.get("JIRA_EMAIL") and config.get("JIRA_TOKEN"):
        session.auth = (config["JIRA_EMAIL"], config["JIRA_TOKEN"])
    elif config.get("JIRA_COOKIE"):
        session.headers["Cookie"] = config["JIRA_COOKIE"]
    else:
        sys.exit("ERROR: Sin credenciales en .env")
    return session


def fetch_all_epics(session: requests.Session) -> list[dict]:
    """Pagina sobre /rest/api/2/search para traer todas las épicas."""
    base_url = config["JIRA_URL"].rstrip("/")
    url = f"{base_url}/rest/api/2/search"
    jql = "project = CAMDP AND issuetype = Epic ORDER BY created DESC"
    fields = (
        "summary,status,assignee,created,updated,priority,"
        "labels,description,resolution,resolutiondate,components,"
        "duedate,customfield_10400,customfield_11805"
    )

    all_issues: list[dict] = []
    start_at = 0
    page_size = 100

    while True:
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": page_size,
            "fields": fields,
        }
        r = session.get(url, params=params, timeout=30)
        if r.status_code != 200:
            sys.exit(f"Jira error {r.status_code}: {r.text[:300]}")

        data = r.json()
        issues = data.get("issues", [])
        all_issues.extend(issues)
        total = data.get("total", 0)
        print(f"  Fetched {len(all_issues)}/{total} epics...")

        if len(all_issues) >= total or not issues:
            break
        start_at += page_size

    return all_issues


def clean_epic(issue: dict) -> dict:
    """Extrae campos útiles de un issue crudo de Jira."""
    f = issue["fields"]
    assignee = f.get("assignee") or {}
    status = f.get("status") or {}
    status_cat = status.get("statusCategory") or {}
    priority = f.get("priority") or {}
    resolution = f.get("resolution") or {}

    return {
        "key": issue["key"],
        "summary": f.get("summary", ""),
        "status": status.get("name", "Unknown"),
        "status_category": status_cat.get("name", "Unknown"),
        "assignee": assignee.get("displayName", "Sin asignar"),
        "assignee_email": assignee.get("emailAddress", ""),
        "priority": priority.get("name", "None"),
        "created": f.get("created", "")[:10],
        "updated": f.get("updated", "")[:10],
        "resolution": resolution.get("name", ""),
        "resolution_date": (f.get("resolutiondate") or "")[:10],
        "labels": f.get("labels", []),
        "components": [c["name"] for c in f.get("components", [])],
        "description": (f.get("description") or "")[:300],
        "url": f"{config['JIRA_URL'].rstrip('/')}/browse/{issue['key']}",
        "start_date": (f.get("customfield_11805") or "")[:10],
        "planned_done_date": (f.get("customfield_10400") or "")[:10],
        "due_date": (f.get("duedate") or "")[:10],
    }


def main() -> None:
    print("Extrayendo épicas CAMDP de Jira...")
    session = build_session()
    raw_issues = fetch_all_epics(session)

    epics = [clean_epic(issue) for issue in raw_issues]

    output_path = DATA_DIR / "epics.json"
    output_path.write_text(
        json.dumps(epics, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\n{len(epics)} épicas guardadas en {output_path}")


if __name__ == "__main__":
    main()
