"""Scheduler para regenerar el sitio a horas específicas.

Ejecuta build.py automáticamente a las 8:00, 12:00 y 17:00.
Uso:
    python src/scheduler.py              # horarios por defecto
    python src/scheduler.py 08:00 14:00  # horarios personalizados
"""

import sys
import time
from datetime import datetime

import schedule

from build import build

DEFAULT_TIMES = ["08:00", "12:00", "17:00"]


def run_build() -> None:
    """Wrapper que ejecuta build con timestamp en logs."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*50}")
    print(f"[{now}] Iniciando build programado...")
    print(f"{'='*50}")
    try:
        build()
        print(f"[{now}] Build completado exitosamente.")
    except Exception as exc:  # noqa: BLE001
        print(f"[{now}] ERROR en build: {exc}")


def main() -> None:
    """Configura y arranca el scheduler."""
    times = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_TIMES

    # Validar formato HH:MM
    for t in times:
        try:
            datetime.strptime(t, "%H:%M")
        except ValueError:
            print(f"Error: '{t}' no es un horario válido (usa HH:MM)")
            sys.exit(1)

    for t in times:
        schedule.every().day.at(t).do(run_build)

    print(f"Scheduler activo. Build programado a: {', '.join(times)}")
    print("Presiona Ctrl+C para detener.\n")

    # Ejecutar build inicial
    run_build()

    try:
        while True:
            schedule.run_pending()
            time.sleep(30)
    except KeyboardInterrupt:
        print("\nScheduler detenido.")


if __name__ == "__main__":
    main()
