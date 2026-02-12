"""Check date fields for Gantt chart."""
import json
from pathlib import Path

epics = json.loads(
    (Path(__file__).parent.parent / "data" / "epics.json").read_text(encoding="utf-8")
)

# Only look at filtered epics (not done or resolved after cutoff)
CUTOFF = "2026-01-15"
filtered = [e for e in epics if e["status"] != "Listo" or e.get("resolution_date", "") >= CUTOFF]

print(f"Filtered epics: {len(filtered)}")
has_start = sum(1 for e in filtered if e["start_date"])
has_planned = sum(1 for e in filtered if e["planned_done_date"])
has_due = sum(1 for e in filtered if e["due_date"])
print(f"  With start_date: {has_start}")
print(f"  With planned_done_date: {has_planned}")
print(f"  With due_date: {has_due}")
print()
for e in filtered:
    print(f"  {e['key']}: start={e['start_date'] or '-':12s} planned={e['planned_done_date'] or '-':12s} due={e['due_date'] or '-':12s} [{e['status']}] {e['summary'][:50]}")
