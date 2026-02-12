"""Calcula métricas y estadísticas de las épicas y issues CAMDP.

Filtra por épicas activas (no-Listo o cerradas >= CUTOFF_DATE).
Clasifica componentes y labels según su prefijo numérico.
Genera métricas por dominio: servicios, cycle time, lead time.
"""

import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUTOFF_DATE = "2026-01-15"
ISSUES_UPDATED_SINCE = "2026-01-05"
TODAY = date.today()

# ------------------------------------------------------------------ #
#  Clasificación de componentes por prefijo                           #
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
    m = _PREFIX_RE.match(name)
    if m:
        prefix, value = m.group(1), m.group(2).replace("_", " ")
        return mapping.get(prefix, f"Grupo {prefix}"), value
    return "Sin clasificar", name.replace("_", " ")


def parse_components(components: list[str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for comp in components:
        cat, val = _classify(comp, COMP_CATEGORIES)
        result.setdefault(cat, []).append(val)
    return result


def parse_labels(labels: list[str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for lbl in labels:
        cat, val = _classify(lbl, LABEL_CATEGORIES)
        result.setdefault(cat, []).append(val)
    return result


def _get_by_prefix(components: list[str], prefix: str) -> list[str]:
    """Extrae nombres limpios de componentes con un prefijo dado."""
    return [
        c.split(".", 1)[1].replace("_", " ")
        for c in components if c.startswith(f"{prefix}.")
    ]


# ------------------------------------------------------------------ #
#  Cycle Time & Lead Time                                            #
# ------------------------------------------------------------------ #

def _parse_date(s: str) -> date | None:
    if not s or len(s) < 10:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _days_between(start_str: str, end_str: str) -> int | None:
    """Días entre dos fechas. Si end está vacío usa TODAY."""
    start = _parse_date(start_str)
    if not start:
        return None
    end = _parse_date(end_str) if end_str else TODAY
    if not end:
        end = TODAY
    delta = (end - start).days
    return max(delta, 0)


def compute_cycle_time(issue: dict) -> int | None:
    """Cycle Time: start_date → resolution_date (o hoy)."""
    return _days_between(issue.get("start_date", ""), issue.get("resolution_date", ""))


def compute_lead_time(issue: dict) -> int | None:
    """Lead Time: created → resolution_date (o hoy)."""
    return _days_between(issue.get("created", ""), issue.get("resolution_date", ""))


def _avg(values: list[int]) -> float:
    return round(sum(values) / len(values), 1) if values else 0


def _time_by_service(issues: list[dict], time_fn) -> dict[str, float]:
    """Promedio de tiempo (cycle/lead) agrupado por servicio."""
    buckets: dict[str, list[int]] = defaultdict(list)
    for iss in issues:
        days = time_fn(iss)
        if days is None:
            continue
        services = _get_by_prefix(iss.get("components", []), "3")
        if not services:
            services = ["Sin servicio"]
        for svc in services:
            buckets[svc].append(days)
    return {k: _avg(v) for k, v in sorted(buckets.items(), key=lambda x: -_avg(x[1]))}


def _stddev(values: list[int | float]) -> float:
    """Desviación estándar poblacional."""
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def build_time_series(issues: list[dict]) -> dict:
    """Construye series de cycle/lead time por ticket en orden de creación.

    Retorna datos para control charts (SPC): puntos, media, UCL, LCL.
    """
    sorted_issues = sorted(issues, key=lambda i: i.get("created", ""))

    ct_points = []
    lt_points = []
    ct_vals: list[int] = []
    lt_vals: list[int] = []

    for iss in sorted_issues:
        ct = iss.get("cycle_time")
        lt = iss.get("lead_time")
        created = iss.get("created", "")
        key = iss.get("key", "")

        if ct is not None:
            ct_points.append({"x": created, "y": ct, "key": key})
            ct_vals.append(ct)
        if lt is not None:
            lt_points.append({"x": created, "y": lt, "key": key})
            lt_vals.append(lt)

    ct_mean = _avg(ct_vals)
    lt_mean = _avg(lt_vals)
    ct_std = round(_stddev(ct_vals), 1)
    lt_std = round(_stddev(lt_vals), 1)

    return {
        "cycle_time": {
            "points": ct_points,
            "mean": ct_mean,
            "ucl": round(ct_mean + 2 * ct_std, 1),
            "lcl": round(max(ct_mean - 2 * ct_std, 0), 1),
        },
        "lead_time": {
            "points": lt_points,
            "mean": lt_mean,
            "ucl": round(lt_mean + 2 * lt_std, 1),
            "lcl": round(max(lt_mean - 2 * lt_std, 0), 1),
        },
    }


# ------------------------------------------------------------------ #
#  Carga y filtrado                                                   #
# ------------------------------------------------------------------ #

def load_epics() -> list[dict]:
    return json.loads((ROOT / "data" / "epics.json").read_text(encoding="utf-8"))


def load_all_issues() -> list[dict]:
    path = ROOT / "data" / "all_issues.json"
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [
        i for i in raw
        if i.get("issuetype") == "Épica"
        or i.get("updated", "") >= ISSUES_UPDATED_SINCE
    ]


def filter_relevant(epics: list[dict]) -> list[dict]:
    return [
        e for e in epics
        if e["status"] != "Listo" or e.get("resolution_date", "") >= CUTOFF_DATE
    ]


def _effective_end_date(epic: dict) -> str:
    today_s = TODAY.isoformat()
    planned = epic.get("planned_done_date", "")
    due = epic.get("due_date", "")
    if planned and planned >= today_s:
        return planned
    if due:
        return due
    return planned or ""


def enrich_epic(epic: dict) -> dict:
    epic["comp_parsed"] = parse_components(epic.get("components", []))
    epic["label_parsed"] = parse_labels(epic.get("labels", []))
    epic["gantt_end"] = _effective_end_date(epic)
    epic["dominios"] = _get_by_prefix(epic.get("components", []), "1")
    epic["servicios"] = _get_by_prefix(epic.get("components", []), "3")
    epic["dominio"] = ", ".join(epic["dominios"])
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


def _week_label(date_str: str) -> str:
    """Convierte '2026-01-15' en 'Sem 2026-01-12' (lunes de esa semana)."""
    d = _parse_date(date_str)
    if not d:
        return ""
    monday = d - __import__("datetime").timedelta(days=d.weekday())
    return f"Sem {monday.isoformat()}"


def enrich_issue(issue: dict) -> dict:
    issue["dominios"] = _get_by_prefix(issue.get("components", []), "1")
    issue["servicios"] = _get_by_prefix(issue.get("components", []), "3")
    issue["dominio"] = ", ".join(issue["dominios"])
    issue["servicio"] = ", ".join(issue["servicios"])
    issue["cycle_time"] = compute_cycle_time(issue)
    issue["lead_time"] = compute_lead_time(issue)
    issue["week"] = _week_label(issue.get("updated", ""))
    return issue


# ------------------------------------------------------------------ #
#  Helpers de conteo                                                  #
# ------------------------------------------------------------------ #

def _count(items: list) -> dict:
    return dict(Counter(items).most_common())


def _count_nested(records: list[dict], *keys: str) -> dict:
    c: Counter = Counter()
    for e in records:
        for k in keys:
            parts = k.split(".")
            vals = e.get(parts[0], {}).get(parts[1], []) if len(parts) == 2 else []
            for v in vals:
                c[v] += 1
    return dict(c.most_common())


# ------------------------------------------------------------------ #
#  Gantt                                                              #
# ------------------------------------------------------------------ #

def build_gantt_items(epics: list[dict]) -> list[dict]:
    gantt = []
    for e in sorted(epics, key=lambda x: x.get("start_date", "")):
        if e["status"] == "Listo":
            continue
        if not e.get("start_date") or not e.get("gantt_end"):
            continue
        planned = e.get("planned_done_date", "")
        due = e.get("due_date", "")
        if e["status"] == "Blocked":
            color = "blocked"
        elif planned and due and planned < due:
            color = "extended"
        else:
            color = "on_track"
        gantt.append({
            "key": e["key"], "summary": e["summary"][:60],
            "start": e["start_date"], "end": e["gantt_end"],
            "planned_done": planned, "due": due,
            "status": e["status"], "color": color,
            "assignee": e["assignee"], "dominio": e["dominio"],
            "equipo": e["equipo_df"], "servicio": e["servicio"],
            "app": e["app_producto"], "tipo": e["tipo"],
        })
    return gantt


# ------------------------------------------------------------------ #
#  Issue data ligero para JS (filtrado dinámico client-side)          #
# ------------------------------------------------------------------ #

def _issue_slim(issue: dict) -> dict:
    """Versión ligera del issue para embed en JS."""
    return {
        "k": issue["key"],
        "t": issue["issuetype"],
        "s": issue["status"],
        "a": issue["assignee"],
        "sv": issue.get("servicio", ""),
        "c": issue.get("created", ""),
        "u": issue.get("updated", ""),
        "w": issue.get("week", ""),
        "ct": issue.get("cycle_time"),
        "lt": issue.get("lead_time"),
        "ek": issue.get("epic_key", ""),
    }


def _collect_weeks(issues: list[dict]) -> list[str]:
    """Retorna lista de semanas ordenadas de los issues."""
    weeks = sorted({i["week"] for i in issues if i.get("week")})
    return weeks


# ------------------------------------------------------------------ #
#  Métricas por dominio                                               #
# ------------------------------------------------------------------ #

def compute_domain_metrics(
    domain_name: str,
    epics: list[dict],
    all_issues: list[dict],
) -> dict:
    dom_epics = [e for e in epics if domain_name in e.get("dominios", [])]
    dom_issues = [i for i in all_issues if domain_name in i.get("dominios", [])]

    active = [e for e in dom_epics if e["status"] in {"Work in Progress", "In Progress"}]
    blocked = [e for e in dom_epics if e["status"] == "Blocked"]
    resolved = sum(1 for e in dom_epics if e["resolution"])

    # Cycle & Lead time
    ct_values = [i["cycle_time"] for i in dom_issues if i["cycle_time"] is not None]
    lt_values = [i["lead_time"] for i in dom_issues if i["lead_time"] is not None]

    # Service distribution (component 3.)
    svc_counter: Counter = Counter()
    for i in dom_issues:
        for s in i.get("servicios", []):
            svc_counter[s] += 1
    service_dist = dict(svc_counter.most_common())

    return {
        "name": domain_name,
        "slug": domain_name.lower().replace(" ", "-"),
        "total_epics": len(dom_epics),
        "total_issues": len(dom_issues),
        "active": len(active),
        "blocked": len(blocked),
        "blocked_epics": blocked,
        "resolved": resolved,
        "resolution_rate": round(resolved / len(dom_epics) * 100, 1) if dom_epics else 0,
        "avg_cycle_time": _avg(ct_values),
        "avg_lead_time": _avg(lt_values),
        "gantt": build_gantt_items(dom_epics),
        "epics": dom_epics,
        "issues": dom_issues,
        "service_dist": service_dist,
        "issuetype_dist": _count([i["issuetype"] for i in dom_issues]),
        "status_dist": _count([i["status"] for i in dom_issues]),
        "assignee_dist": _count([i["assignee"] for i in dom_issues]),
        "cycle_time_by_service": _time_by_service(dom_issues, compute_cycle_time),
        "lead_time_by_service": _time_by_service(dom_issues, compute_lead_time),
        "time_series": build_time_series(dom_issues),
        "issues_slim": [_issue_slim(i) for i in dom_issues],
        "weeks": _collect_weeks(dom_issues),
    }


# ------------------------------------------------------------------ #
#  Pipeline principal                                                 #
# ------------------------------------------------------------------ #

def compute_all_metrics() -> dict:
    raw = load_epics()
    filtered = filter_relevant(raw)
    epics = [enrich_epic(e) for e in filtered]
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    all_issues_raw = load_all_issues()
    all_issues = [enrich_issue(i) for i in all_issues_raw]

    active = [e for e in epics if e["status"] in {"Work in Progress", "In Progress"}]
    blocked = [e for e in epics if e["status"] == "Blocked"]
    done_recent = [e for e in epics if e["status"] == "Listo"]

    # Dominios
    domain_names: set[str] = set()
    for e in epics:
        domain_names.update(e.get("dominios", []))
    for i in all_issues:
        domain_names.update(i.get("dominios", []))

    domains = [
        compute_domain_metrics(d, epics, all_issues)
        for d in sorted(domain_names)
    ]

    # Global cycle/lead time
    ct_all = [i["cycle_time"] for i in all_issues if i["cycle_time"] is not None]
    lt_all = [i["lead_time"] for i in all_issues if i["lead_time"] is not None]

    gantt = build_gantt_items(epics)

    return {
        "generated_at": now,
        "cutoff_date": CUTOFF_DATE,
        "total_raw": len(raw),
        "total_epics": len(epics),
        "total_all_issues": len(all_issues),
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
        "issuetype_dist": _count([i["issuetype"] for i in all_issues]),
        "monthly": dict(sorted(
            Counter(e["created"][:7] for e in epics if e["created"]).items()
        )),
        "resolution": {
            "total": len(epics),
            "resolved": sum(1 for e in epics if e["resolution"]),
            "unresolved": sum(1 for e in epics if not e["resolution"]),
            "rate_pct": round(
                sum(1 for e in epics if e["resolution"]) / len(epics) * 100, 1,
            ) if epics else 0,
        },
        "avg_cycle_time": _avg(ct_all),
        "avg_lead_time": _avg(lt_all),
        "cycle_time_by_service": _time_by_service(all_issues, compute_cycle_time),
        "lead_time_by_service": _time_by_service(all_issues, compute_lead_time),
        "service_dist_global": _count(
            [s for i in all_issues for s in i.get("servicios", [])]
        ),
        "time_series": build_time_series(all_issues),
        "issues_slim": [_issue_slim(i) for i in all_issues],
        "weeks": _collect_weeks(all_issues),
        "active_epics": active,
        "blocked_epics": blocked,
        "done_recent": done_recent,
        "gantt": gantt,
        "domains": domains,
        "domain_names": sorted(domain_names),
    }
