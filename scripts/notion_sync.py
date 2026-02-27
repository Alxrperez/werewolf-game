#!/usr/bin/env python3
import os
import re
import json
import urllib.request

ROOT = os.path.dirname(os.path.dirname(__file__))
TASKS = os.path.join(ROOT, "TASKS.md")
NOTION_TOKEN = os.getenv("NOTION_TOKEN", "")
DATABASE_ID = os.getenv("NOTION_DATABASE_ID", "")

API = "https://api.notion.com/v1"
VERSION = "2022-06-28"


def parse_tasks(path: str):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    section = None
    out = []
    for raw in lines:
        line = raw.strip()
        if line.startswith("## "):
            name = line[3:].strip().lower()
            if name in {"now (wip limit: 3)", "now"}:
                section = "Now"
            elif name == "next":
                section = "Next"
            elif name == "later":
                section = "Later"
            else:
                section = None
            continue
        if not section:
            continue

        m = re.match(r"- \[.\] (.*)", line)
        if not m:
            continue
        title = m.group(1).strip()
        if not title:
            continue

        size = None
        size_m = re.match(r"\((S|M|L)\)\s+(.*)", title)
        if size_m:
            size = size_m.group(1)
            title = size_m.group(2).strip()

        out.append({"title": title, "status": section, "size": size})
    return out


def notion_request(method: str, path: str, payload=None):
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": VERSION,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))


def page_exists(title: str, status: str):
    payload = {
        "filter": {
            "and": [
                {"property": "Name", "title": {"equals": title}},
                {"property": "Status", "select": {"equals": status}},
            ]
        }
    }
    data = notion_request("POST", f"/databases/{DATABASE_ID}/query", payload)
    return len(data.get("results", [])) > 0


def create_page(task):
    props = {
        "Name": {"title": [{"text": {"content": task["title"]}}]},
        "Status": {"select": {"name": task["status"]}},
    }
    if task.get("size"):
        props["Size"] = {"select": {"name": task["size"]}}

    payload = {
        "parent": {"database_id": DATABASE_ID},
        "properties": props,
    }
    notion_request("POST", "/pages", payload)


def main():
    if not NOTION_TOKEN or not DATABASE_ID:
        raise SystemExit("Missing NOTION_TOKEN or NOTION_DATABASE_ID")
    tasks = parse_tasks(TASKS)
    created = 0
    skipped = 0
    for t in tasks:
        if page_exists(t["title"], t["status"]):
            skipped += 1
            continue
        create_page(t)
        created += 1

    print(f"Notion sync complete: created={created}, skipped={skipped}, total={len(tasks)}")


if __name__ == "__main__":
    main()
