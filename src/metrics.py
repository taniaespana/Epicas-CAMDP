"""Calcula métricas y estadísticas de las épicas CAMDP.

Filtra por épicas activas (no-Listo o cerradas >= 2026-01-15).
Clasifica componentes y labels según su prefijo numérico.
"""

import json
import re
from collections import Counter
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUTOFF_DATE = "2026-01-15"

# ------------------------------------------------------------------ #
#  Clasificación de componentes y labels por prefijo                  #
# ------------------------------------------------------------------ #
COMP_CATEGORIES = {
    "1": "Dominio",
    "2": "Equipo DF",
    "3": "Servicio",
    "4": "App / Producto",
    "5": "Tipo (Ext/Int)",
}

LABEL_CATEGORIES = {
    "1": "Servicio",
    "2": "App / Producto",
    "3": "Tipo (Ext/Int)",
}

_PREFIX_RE = re.compile(r"^(\d+)\.(.+)$")


def _classify(name: str, mapping: dict) -> tuple[str, str]:
    """Clasifica un componente/label por su prefijo numérico."""
    m = _PREFIX_RE.match(name)
    if m:
        prefix, value = m.group(1), m.group(2).replace("_", " ")
        category = mapping.get(prefix, f"Grupo {prefix}")
        return category, value
    return "Sin clasificar", name.replace("_", " ")


def parse_components(components: list[str]) -> dict[str, list[str]]:
    """Clasifica lista de componentes en sus categorías."""
    result: dict[str, list[str]] = {}
    for comp in components:
        cat, val = _classify(comp, COMP_CATEGORIES)
        result.setdefault(cat, []).append(val)
    return result


def parse_labels(labels: list[str]) -> dict[str, list[str]]:
    """Clasifica lista de labels en sus categorías."""
    result: dict[str, list[str]] = {}
    for lbl in labels:
        cat, val = _classify(lbl, LABEL_CATEGORIES)
        result.setdefault(cat, []).append(val)
    return result


# ------------------------------------------------------------------ #
#  Carga y filtrado                                                   #
# ------------------------------------------------------------------ #

def load_epics() -> list[dict]:
    path = ROOT / "data" / "epics.json"
    return json.loads(path.read_text(encoding="utf-8"))


def filter_relevant(epics: list[dict]) -> list[dict]:
    """Epicas abiertas + cerradas desde CUTOFF_DATE."""
    return [
        e for e in epics
        if e["status"] != "Listo"
        or e.get("resolution_date", "") >= CUTOFF_DATE
    ]


def _effective_end_date(epic: dict) -> str:
    """Calcula fecha fin efectiva para Gantt.

    Prioridad: planned_done_date si existe y no vencido, sino due_date.
    """
    today = date.today().isoformat()
    planned = epic.get("planned_done_date", "")
    due = epic.get("due_date", "")

    if planned and planned >= today:
        return planned
    if due:
        return due
    # Fallback: si planned existe pero vencido y no hay due, usar planned
    if planned:
        return planned
    return ""


def enrich_epic(epic: dict) -> dict:
    """Agrega campos clasificados y fecha Gantt al epic."""
    epic["comp_parsed"] = parse_components(epic.get("components", []))
    epic["label_parsed"] = parse_labels(epic.get("labels", []))
    epic["gantt_end"] = _effective_end_date(epic)

    epic["dominio"] = ", ".join(epic["comp_parsed"].get("Dominio", []))
    epic["equipo_df"] = ", ".join(epic["comp_parsed"].get("Equipo DF", []))
    epic["servicio"] = ", ".join(
        list(dict.fromkeys(
            epic["comp_parsed"].get("Servicio", [])
            + epic["label_parsed"].get("Servicio", [])
        ))
    )
    epic["app_producto"] = ", ".join(
        list(dict.fromkeys(
            epic["comp_parsed"].get("App / Producto", [])
            + epic["label_parsed"].get("App / Producto", [])
        ))
    )
    epic["tipo"] = ", ".join(
        list(dict.fromkeys(
            epic["comp_parsed"].get("Tipo (Ext/Int)", [])
            + epic["label_parsed"].get("Tipo (Ext/Int)", [])
        ))
    )
    return epic


# ------------------------------------------------------------------ #
#  Métricas                                                           #
# ------------------------------------------------------------------ #

def _count(items: list) -> dict:
    return dict(Counter(items).most_common())


def _count_nested(epics: list[dict], *keys: str) -> dict:
    """Cuenta valores de campos clasificados (comp_parsed/label_parsed)."""
    c: Counter = Counter()
    for e in epics:
        for k in keys:
            parts = k.split(".")
            vals = e.get(parts[0], {}).get(parts[1], []) if len(parts) == 2 else []
            for v in vals:
                c[v] += 1
    return dict(c.most_common())


def compute_all_metrics() -> dict:
    """Pipeline completo: carga -> filtra -> enriquece -> métricas."""
    raw = load_epics()
    filtered = filter_relevant(raw)
    epics = [enrich_epic(e) for e in filtered]
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    active = [e for e in epics if e["status"] in {"Work in Progress", "In Progress"}]
    blocked = [e for e in epics if e["status"] == "Blocked"]
    done_recent = [e for e in epics if e["status"] == "Listo"]

    # Gantt: excluir Listo, solo épicas con fechas válidas
    gantt = []
    for e in sorted(epics, key=lambda x: x.get("start_date", "")):
        if e["status"] == "Listo":
            continue
        if not e.get("start_date") or not e.get("gantt_end"):
            continue
        planned = e.get("planned_done_date", "")
        due = e.get("due_date", "")
        # Color: azul si extendida (planned < due), verde si iguales/sin due
        if e["status"] == "Blocked":
            color = "blocked"
        elif planned and due and planned < due:
            color = "extended"   # azul — se extendió
        else:
            color = "on_track"   # verde — en tiempo
        gantt.append({
            "key": e["key"],
            "summary": e["summary"][:60],
            "start": e["start_date"],
            "end": e["gantt_end"],
            "planned_done": planned,
            "due": due,
            "status": e["status"],
            "color": color,
            "assignee": e["assignee"],
            "dominio": e["dominio"],
            "equipo": e["equipo_df"],
            "servicio": e["servicio"],
            "app": e["app_producto"],
            "tipo": e["tipo"],
        })

    return {
        "generated_at": now,
        "cutoff_date": CUTOFF_DATE,
        "total_raw": len(raw),
        "total_epics": len(epics),
        "epics": epics,
        "status_dist": _count([e["status"] for e in epics]),
        "dominio_dist": _count_nested(epics, "comp_parsed.Dominio"),
        "equipo_df_dist": _count_nested(epics, "comp_parsed.Equipo DF"),
        "servicio_dist": _count_nested(
            epics, "comp_parsed.Servicio", "label_parsed.Servicio",
        ),
        "app_dist": _count_nested(
            epics, "comp_parsed.App / Producto", "label_parsed.App / Producto",
        ),
        "tipo_dist": _count_nested(
            epics, "comp_parsed.Tipo (Ext/Int)", "label_parsed.Tipo (Ext/Int)",
        ),
        "assignee_dist": _count([e["assignee"] for e in epics]),
        "monthly": dict(sorted(
            Counter(e["created"][:7] for e in epics if e["created"]).items()
        )),
        "quarterly": dict(sorted(
            Counter(
                f"{datetime.strptime(e['created'][:10], '%Y-%m-%d').year}"
                f"-Q{(datetime.strptime(e['created'][:10], '%Y-%m-%d').month - 1) // 3 + 1}"
                for e in epics if e["created"]
            ).items()
        )),
        "resolution": {
            "total": len(epics),
            "resolved": sum(1 for e in epics if e["resolution"]),
            "unresolved": sum(1 for e in epics if not e["resolution"]),
            "rate_pct": round(
                sum(1 for e in epics if e["resolution"]) / len(epics) * 100, 1
            ) if epics else 0,
        },
        "active_epics": active,
        "blocked_epics": blocked,
        "done_recent": done_recent,
        "gantt": gantt,
    }
