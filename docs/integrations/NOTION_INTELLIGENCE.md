# Notion Intelligence Agent Setup

This adds a cycle runner that updates 4 Notion databases:
- PROJECTS
- AGENTS
- TASKS
- SYSTEM METRICS

## 1) Required env vars

```bash
export NOTION_TOKEN="secret_xxx"
export NOTION_DB_PROJECTS="<database-id>"
export NOTION_DB_AGENTS="<database-id>"
export NOTION_DB_TASKS="<database-id>"
export NOTION_DB_METRICS="<database-id>"
```

## 2) Expected database property names

### PROJECTS
- Project Name (title)
- Description (rich text)
- Status (select)
- Priority (select)
- Progress % (number)
- Last Updated (date)
- AI Summary (rich text)

### AGENTS
- Agent Name (title)
- Machine (rich text)
- Role (select)
- Current Task (rich text)
- Status (select)
- Resource Usage Snapshot (rich text)
- Last Heartbeat (date)

### TASKS
- Task Name (title)
- Status (select)
- Logs (rich text)
- Result (rich text)
- AI Evaluation (rich text)

### SYSTEM METRICS
- Machine Name (title)
- CPU Usage (rich text)
- RAM Usage (rich text)
- GPU Usage (rich text)
- Active Processes (rich text)
- Timestamp (date)

## 3) Run one cycle manually

```bash
python3 scripts/notion_intel_cycle.py
```

## 4) Optional schedule (every 30 min)

```bash
openclaw cron add \
  --name "notion:intel-cycle" \
  --agent main \
  --session isolated \
  --every "30m" \
  --no-deliver \
  --message "Run: python3 /home/user/.openclaw/workspace/scripts/notion_intel_cycle.py and report errors only."
```

