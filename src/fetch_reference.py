"""Fetch reference page and CAMDP epics from Jira."""

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


def fetch_reference(session: requests.Session) -> None:
    """Descarga la pagina de referencia."""
    print("=== Fetching reference page ===")
    try:
        r = session.get(
            "https://gecgithub01.walmart.com/pages/l0c0k21/presentacion-fabrica/",
            timeout=10,
        )
        print(f"Status: {r.status_code}, Length: {len(r.text)}")
        (DATA_DIR / "reference_page.html").write_text(r.text, encoding="utf-8")
        print("Saved to data/reference_page.html")
    except Exception as e:
        print(f"Could not fetch reference: {e}")


def fetch_epics(session: requests.Session) -> None:
    """Descarga epicas CAMDP desde Jira."""
    print("\n=== Fetching CAMDP epics from Jira ===")
    jql = "project = CAMDP AND issuetype = Epic ORDER BY created DESC"
    url = f"{config['JIRA_URL'].rstrip('/')}/rest/api/2/search"
    params = {
        "jql": jql,
        "maxResults": 100,
        "fields": (
            "summary,status,assignee,created,updated,priority,"
            "labels,customfield_10006,description,resolution,"
            "resolutiondate,components"
        ),
    }

    r = session.get(url, params=params, timeout=30)
    print(f"Status: {r.status_code}")

    if r.status_code == 200:
        data = r.json()
        print(f"Total epics found: {data.get('total', 0)}")
        (DATA_DIR / "epics_raw.json").write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print("Saved to data/epics_raw.json")
        for issue in data.get("issues", []):
            key = issue["key"]
            summary = issue["fields"]["summary"]
            status = issue["fields"]["status"]["name"]
            print(f"  {key}: [{status}] {summary}")
    else:
        print(f"Error: {r.status_code}")
        print(r.text[:500])


def main() -> None:
    session = build_session()
    fetch_reference(session)
    fetch_epics(session)


if __name__ == "__main__":
    main()
