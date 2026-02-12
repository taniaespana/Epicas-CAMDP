"""Genera el sitio estático en site/index.html.

Usa las métricas calculadas y las plantillas Jinja2.
"""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from metrics import compute_all_metrics

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "templates"
SITE_DIR = ROOT / "site"


def build() -> None:
    """Renderiza index.html con todas las métricas."""
    print("Calculando métricas...")
    ctx = compute_all_metrics()

    print(f"  {ctx['total_epics']} épicas, {ctx['resolution']['resolved']} resueltas")
    print(f"  {len(ctx['active_epics'])} en progreso, {len(ctx['blocked_epics'])} bloqueadas")

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=True)
    template = env.get_template("index.html")

    html = template.render(**ctx)

    SITE_DIR.mkdir(exist_ok=True)
    output = SITE_DIR / "index.html"
    output.write_text(html, encoding="utf-8")
    print(f"\nOK Sitio generado: {output}")
    print(f"   Tamaño: {len(html):,} bytes")


if __name__ == "__main__":
    build()
