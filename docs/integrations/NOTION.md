# Notion Integration (Project Tracking)

This integration syncs `TASKS.md` items into a Notion database.

## Required Notion setup

1. Create an internal integration in Notion and copy the token.
2. Share your target database with the integration.
3. Copy the database ID from the Notion URL.

## Environment variables

Set these before running the sync:

```bash
export NOTION_TOKEN="secret_xxx"
export NOTION_DATABASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Sync command

```bash
python3 scripts/notion_sync.py
```

## Mapping

- `TASKS.md` checkbox item -> Notion page title
- Section -> `Status` select (`Now` / `Next` / `Later`)
- Size marker `(S)/(M)/(L)` -> `Size` select

## Notes

- Sync is idempotent by title + status.
- Existing entries with same title/status are skipped.
- This is intentionally simple for MVP project operations.
