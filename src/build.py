"""Genera el sitio estático en site/.

Renderiza index.html con Jinja2 y copia assets.
"""

import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from metrics import compute_all_metrics

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "templates"
SITE_DIR = ROOT / "docs"


def build() -> None:
    """Renderiza index.html y copia assets al directorio site/."""
    print("Calculando metricas...")
    ctx = compute_all_metrics()

    print(f"  {ctx['total_epics']} epicas filtradas de {ctx['total_raw']} totales")
    print(f"  {len(ctx['active_epics'])} en progreso, {len(ctx['blocked_epics'])} bloqueadas")

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)
    template = env.get_template("index.html")
    html = template.render(**ctx)

    SITE_DIR.mkdir(exist_ok=True)
    output = SITE_DIR / "index.html"
    output.write_text(html, encoding="utf-8")

    # Copy JS asset
    js_src = TEMPLATE_DIR / "dashboard.js"
    if js_src.exists():
        shutil.copy2(js_src, SITE_DIR / "dashboard.js")

    print(f"\nOK Sitio generado en {SITE_DIR}")
    print(f"   index.html: {len(html):,} bytes")


if __name__ == "__main__":
    build()
