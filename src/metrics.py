"""Calcula métricas y estadísticas de las épicas CAMDP.

Lee data/epics.json y produce un dict con todas las métricas
para consumo de las plantillas.
"""

import json
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_epics() -> list[dict]:
    """Carga las épicas limpias desde JSON."""
    path = ROOT / "data" / "epics.json"
    return json.loads(path.read_text(encoding="utf-8"))


def status_distribution(epics: list[dict]) -> dict:
    """Conteo por status."""
    return dict(Counter(e["status"] for e in epics).most_common())


def status_category_distribution(epics: list[dict]) -> dict:
    """Conteo por categoría de status (Por hacer, En curso, Listo)."""
    return dict(Counter(e["status_category"] for e in epics).most_common())


def component_distribution(epics: list[dict]) -> dict:
    """Conteo por componente (una épica puede tener múltiples)."""
    counter: Counter = Counter()
    for e in epics:
        for comp in e["components"]:
            counter[comp] += 1
    return dict(counter.most_common(20))


def assignee_distribution(epics: list[dict]) -> dict:
    """Top 15 assignees por cantidad de épicas."""
    return dict(Counter(e["assignee"] for e in epics).most_common(15))


def label_distribution(epics: list[dict]) -> dict:
    """Top 15 labels más usados."""
    counter: Counter = Counter()
    for e in epics:
        for label in e["labels"]:
            counter[label] += 1
    return dict(counter.most_common(15))


def monthly_creation(epics: list[dict]) -> dict:
    """Cantidad de épicas creadas por mes (YYYY-MM)."""
    counter: Counter = Counter()
    for e in epics:
        if e["created"]:
            month = e["created"][:7]  # YYYY-MM
            counter[month] += 1
    return dict(sorted(counter.items()))


def quarterly_creation(epics: list[dict]) -> dict:
    """Cantidad de épicas creadas por trimestre."""
    counter: Counter = Counter()
    for e in epics:
        if e["created"]:
            try:
                dt = datetime.strptime(e["created"][:10], "%Y-%m-%d")
                q = (dt.month - 1) // 3 + 1
                counter[f"{dt.year}-Q{q}"] += 1
            except ValueError:
                continue
    return dict(sorted(counter.items()))


def resolution_rate(epics: list[dict]) -> dict:
    """Tasa de resolución."""
    total = len(epics)
    resolved = sum(1 for e in epics if e["resolution"])
    return {
        "total": total,
        "resolved": resolved,
        "unresolved": total - resolved,
        "rate_pct": round(resolved / total * 100, 1) if total else 0,
    }


def active_epics(epics: list[dict]) -> list[dict]:
    """Epicas actualmente en progreso (no Listo, no Backlog)."""
    active_statuses = {"Work in Progress", "In Progress", "Blocked"}
    return [
        e for e in epics
        if e["status"] in active_statuses
    ]


def blocked_epics(epics: list[dict]) -> list[dict]:
    """Epicas bloqueadas."""
    return [e for e in epics if e["status"] == "Blocked"]


def compute_all_metrics() -> dict:
    """Calcula todas las métricas y las empaqueta."""
    epics = load_epics()
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    return {
        "generated_at": now,
        "total_epics": len(epics),
        "epics": epics,
        "status_dist": status_distribution(epics),
        "status_cat_dist": status_category_distribution(epics),
        "component_dist": component_distribution(epics),
        "assignee_dist": assignee_distribution(epics),
        "label_dist": label_distribution(epics),
        "monthly": monthly_creation(epics),
        "quarterly": quarterly_creation(epics),
        "resolution": resolution_rate(epics),
        "active_epics": active_epics(epics),
        "blocked_epics": blocked_epics(epics),
    }
