"""Verifica la conexión y autenticación contra Jira.

Lee credenciales desde .env y prueba GET /rest/api/2/myself.
"""

import sys
from pathlib import Path

import requests
from dotenv import dotenv_values

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def load_config() -> dict[str, str]:
    """Carga variables desde .env y valida que haya credenciales."""
    if not ENV_PATH.exists():
        sys.exit(f"ERROR: No se encontró {ENV_PATH}")

    config = dotenv_values(ENV_PATH)
    if not config.get("JIRA_URL"):
        sys.exit("ERROR: JIRA_URL está vacía en .env")

    has_basic = config.get("JIRA_EMAIL") and config.get("JIRA_TOKEN")
    has_cookie = config.get("JIRA_COOKIE")

    if not has_basic and not has_cookie:
        sys.exit(
            "ERROR: Necesitas JIRA_EMAIL+JIRA_TOKEN o JIRA_COOKIE en .env"
        )

    return config


def build_session(config: dict[str, str]) -> requests.Session:
    """Construye una Session con la auth adecuada."""
    session = requests.Session()

    if config.get("JIRA_EMAIL") and config.get("JIRA_TOKEN"):
        session.auth = (config["JIRA_EMAIL"], config["JIRA_TOKEN"])
        print("Usando auth básica (email + token)")
    else:
        session.headers["Cookie"] = config["JIRA_COOKIE"]
        print("Usando cookie de sesión")

    return session


def ping(session: requests.Session, base_url: str) -> None:
    """Hace GET /rest/api/2/myself e imprime el resultado."""
    url = f"{base_url.rstrip('/')}/rest/api/2/myself"
    print(f"GET {url}")

    response = session.get(url, timeout=15)

    if response.status_code == 200:
        data = response.json()
        name = data.get("displayName", "???")
        email = data.get("emailAddress", "???")
        print(f"OK auth para {name} ({email})")
        return

    # Auth fallida — mostrar diagnóstico
    print(f"ERROR {response.status_code}")
    print(f"Body: {response.text[:500]}")
    sys.exit(1)


def main() -> None:
    config = load_config()
    session = build_session(config)
    try:
        ping(session, config["JIRA_URL"])
    except requests.ConnectionError as exc:
        sys.exit(f"ERROR de conexión: {exc}")
    except requests.Timeout:
        sys.exit("ERROR: Timeout al conectar con Jira (15s)")
    except requests.RequestException as exc:
        sys.exit(f"ERROR inesperado en la petición: {exc}")


if __name__ == "__main__":
    main()
