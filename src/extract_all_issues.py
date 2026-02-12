"""Extrae TODOS los issues de CAMDP (no solo épicas) con paginación.

Guarda datos limpios en data/all_issues.json.
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
    """Sesion autenticada contra Jira via cookie."""
    session = requests.Session()
    cookie = config.get("JIRA_COOKIE", "")
    if not cookie:
        sys.exit("ERROR: JIRA_COOKIE no configurada en .env")
    session.headers["Cookie"] = cookie
    return session


def fetch_all_issues(session: requests.Session) -> list[dict]:
    """Pagina sobre /rest/api/2/search para traer todos los issues."""
    base_url = config["JIRA_URL"].rstrip("/")
    url = f"{base_url}/rest/api/2/search"
    jql = "project = CAMDP ORDER BY created DESC"
    fields = (
        "summary,status,issuetype,assignee,created,updated,"
        "priority,labels,components,resolution,resolutiondate,"
        "duedate,customfield_10400,customfield_11805,"
        "customfield_10008"  # Epic Link
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
        print(f"  Fetched {len(all_issues)}/{total} issues...")

        if len(all_issues) >= total or not issues:
            break
        start_at += page_size

    return all_issues


def clean_issue(issue: dict) -> dict:
    """Extrae campos útiles de un issue crudo de Jira."""
    f = issue["fields"]
    assignee = f.get("assignee") or {}
    status = f.get("status") or {}
    status_cat = status.get("statusCategory") or {}
    priority = f.get("priority") or {}
    resolution = f.get("resolution") or {}
    issuetype = f.get("issuetype") or {}

    return {
        "key": issue["key"],
        "summary": f.get("summary", ""),
        "issuetype": issuetype.get("name", "Unknown"),
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
        "description": (f.get("description") or "")[:200],
        "url": f"{config['JIRA_URL'].rstrip('/')}/browse/{issue['key']}",
        "start_date": (f.get("customfield_11805") or "")[:10],
        "planned_done_date": (f.get("customfield_10400") or "")[:10],
        "due_date": (f.get("duedate") or "")[:10],
        "epic_key": f.get("customfield_10008") or "",
    }


def main() -> None:
    print("Extrayendo TODOS los issues CAMDP de Jira...")
    session = build_session()
    raw_issues = fetch_all_issues(session)

    issues = [clean_issue(issue) for issue in raw_issues]

    # Conteo por tipo
    type_counts: dict[str, int] = {}
    for iss in issues:
        t = iss["issuetype"]
        type_counts[t] = type_counts.get(t, 0) + 1

    output_path = DATA_DIR / "all_issues.json"
    output_path.write_text(
        json.dumps(issues, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    print(f"\n{len(issues)} issues guardados en {output_path}")
    print("Distribucion por tipo:")
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")


if __name__ == "__main__":
    main()
