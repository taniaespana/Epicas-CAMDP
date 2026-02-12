"""One-shot script to clean .env cookie value."""
import re
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
raw = env_path.read_text(encoding="utf-8")

start = raw.index('JIRA_COOKIE="') + len('JIRA_COOKIE="')
end = raw.rindex('"')
cookie = raw[start:end]

# Remove userData={...nested JSON...};
cookie = re.sub(r'userData=\{[^}]*(\{[^}]*\}[^}]*)*\};\s*', '', cookie)

env_path.write_text(
    f"JIRA_URL=https://jira.walmart.com\nJIRA_COOKIE={cookie}\n",
    encoding="utf-8",
)
print(f"OK - Cookie cleaned, length: {len(cookie)}")
