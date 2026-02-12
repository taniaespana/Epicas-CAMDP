"""Quick inspection of components, labels, and statuses."""
import json
from collections import Counter
from pathlib import Path

epics = json.loads(
    (Path(__file__).parent.parent / "data" / "epics.json").read_text(encoding="utf-8")
)

print("=== COMPONENTES ===")
comps = Counter()
for e in epics:
    for c in e["components"]:
        comps[c] += 1
for k, v in comps.most_common():
    print(f"  {k}: {v}")

print("\n=== LABELS ===")
labels = Counter()
for e in epics:
    for lbl in e["labels"]:
        labels[lbl] += 1
for k, v in labels.most_common():
    print(f"  {k}: {v}")

print("\n=== STATUSES ===")
for k, v in Counter(e["status"] for e in epics).most_common():
    print(f"  {k}: {v}")

print("\n=== RESOLUTION DATES (sample) ===")
for e in epics[:20]:
    if e["resolution_date"]:
        print(f"  {e['key']}: {e['status']} resolved={e['resolution_date']}")
