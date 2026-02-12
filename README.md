# CAMDP Epics Site

Generador de página estática para listar y visualizar las **épicas del programa CAMDP**.

## Objetivo

Este proyecto automatiza la generación de un sitio estático que:

1. **Lista las épicas CAMDP** a partir de datos estructurados (JSON/CSV en `data/`).
2. **Genera páginas HTML** usando plantillas Jinja2 (en `templates/`).
3. **Publica el sitio** resultante en `site/` listo para servir o desplegar.
4. **Produce reportes** de estado y métricas en `reports/`.

## Estructura del Proyecto

```
camdp-epics-site/
├── src/          # Código fuente (scripts de generación)
├── data/         # Datos de épicas (JSON, CSV, etc.)
├── templates/    # Plantillas Jinja2 para el sitio
├── site/         # Salida: sitio estático generado
├── reports/      # Reportes generados
└── README.md     # Este archivo
```

## Requisitos

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) para gestión de dependencias

## Inicio Rápido

```bash
uv venv
.venv\Scripts\activate   # Windows
uv pip install -r requirements.txt --index-url https://pypi.ci.artifacts.walmart.com/artifactory/api/pypi/external-pypi/simple --allow-insecure-host pypi.ci.artifacts.walmart.com
python src/build.py
```

El sitio generado estará en `site/index.html`.

## Licencia

Uso interno — Walmart Inc.
