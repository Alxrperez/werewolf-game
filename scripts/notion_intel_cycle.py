#!/usr/bin/env python3
import json
import os
import re
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

API = "https://api.notion.com/v1"
VERSION = "2022-06-28"

NOTION_TOKEN = os.getenv("NOTION_TOKEN", "")
DB_PROJECTS = os.getenv("NOTION_DB_PROJECTS", "")
DB_AGENTS = os.getenv("NOTION_DB_AGENTS", "")
DB_TASKS = os.getenv("NOTION_DB_TASKS", "")
DB_METRICS = os.getenv("NOTION_DB_METRICS", "")

PROJECT_NAME = os.getenv("PROJECT_NAME", "Build-a-Werewolf")
PROJECT_DESC = os.getenv("PROJECT_DESC", "Google Meet add-on MVP with Firebase realtime gameplay")


def sh(cmd: str) -> str:
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT).strip()
    except Exception as e:
        return f"ERR: {e}"


def notion(method: str, path: str, payload=None):
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API + path,
        method=method,
        data=data,
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": VERSION,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def query_by_title(db_id: str, title_prop: str, value: str):
    payload = {"filter": {"property": title_prop, "title": {"equals": value}}}
    return notion("POST", f"/databases/{db_id}/query", payload).get("results", [])


def upsert_page(db_id: str, title_prop: str, title_val: str, properties: dict):
    rows = query_by_title(db_id, title_prop, title_val)
    if rows:
        notion("PATCH", f"/pages/{rows[0]['id']}", {"properties": properties})
        return rows[0]["id"], "updated"
    payload = {
        "parent": {"database_id": db_id},
        "properties": {title_prop: {"title": [{"text": {"content": title_val}}]}, **properties},
    }
    created = notion("POST", "/pages", payload)
    return created["id"], "created"


def parse_status_block(txt: str):
    # lightweight parsing from `openclaw status`
    agents = None
    sessions = None
    m = re.search(r"Agents\s+│\s+([^│]+)", txt)
    if m:
        agents = m.group(1).strip()
    m = re.search(r"Sessions\s+│\s+([^│]+)", txt)
    if m:
        sessions = m.group(1).strip()
    return agents or "unknown", sessions or "unknown"


def system_metrics():
    host = socket.gethostname()
    cpu = sh("awk -v RS='' '{idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; print idle, total}' /proc/stat | head -n1")
    time.sleep(0.2)
    cpu2 = sh("awk -v RS='' '{idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; print idle, total}' /proc/stat | head -n1")
    cpu_pct = "n/a"
    try:
        i1, t1 = map(float, cpu.split())
        i2, t2 = map(float, cpu2.split())
        cpu_pct = round(100 * (1 - ((i2 - i1) / (t2 - t1))), 1)
    except Exception:
        pass

    mem_line = sh("free -m | awk '/Mem:/ {printf \"%s/%sMB (%.1f%%)\", $3,$2,($3/$2)*100}'")
    gpu = sh("nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -n1")
    if gpu.startswith("ERR") or gpu == "":
        gpu = "N/A"
    procs = sh("ps -eo comm= | sort | uniq -c | sort -rn | head -n 5 | tr '\n' '; '")
    return host, cpu_pct, mem_line, gpu, procs


def main():
    missing = [k for k, v in {
        "NOTION_TOKEN": NOTION_TOKEN,
        "NOTION_DB_PROJECTS": DB_PROJECTS,
        "NOTION_DB_AGENTS": DB_AGENTS,
        "NOTION_DB_TASKS": DB_TASKS,
        "NOTION_DB_METRICS": DB_METRICS,
    }.items() if not v]
    if missing:
        raise SystemExit("Missing env vars: " + ", ".join(missing))

    now = datetime.now(timezone.utc).isoformat()
    oc_status = sh("openclaw status")
    agents_summary, sessions_summary = parse_status_block(oc_status)

    host, cpu, mem, gpu, procs = system_metrics()

    progress = 26
    proj_summary = (
        "Current state: Foundation complete, core build in progress. "
        "Key issue: Core gameplay loop not landed yet. "
        "Next recommended action: Finish Chunk 2 (typed Firestore + lobby/host controls)."
    )

    # PROJECTS
    upsert_page(DB_PROJECTS, "Project Name", PROJECT_NAME, {
        "Description": {"rich_text": [{"text": {"content": PROJECT_DESC}}]},
        "Status": {"select": {"name": "Active"}},
        "Priority": {"select": {"name": "High"}},
        "Progress %": {"number": progress},
        "Last Updated": {"date": {"start": now}},
        "AI Summary": {"rich_text": [{"text": {"content": proj_summary}}]},
    })

    # AGENTS (minimal snapshot for main + helper)
    for name, role, task, status in [
        ("main", "Coder", "Deliver Werewolf MVP", "Running"),
        ("werewolf-builder", "Executor", "Implement chunked features", "Running"),
        ("ollama-qwen-coder", "Analyst", "Low-thinking coding support", "Idle"),
    ]:
        upsert_page(DB_AGENTS, "Agent Name", name, {
            "Machine": {"rich_text": [{"text": {"content": host}}]},
            "Role": {"select": {"name": role}},
            "Current Task": {"rich_text": [{"text": {"content": task}}]},
            "Status": {"select": {"name": status}},
            "Resource Usage Snapshot": {"rich_text": [{"text": {"content": f"CPU {cpu}% | RAM {mem} | GPU {gpu}"}}]},
            "Last Heartbeat": {"date": {"start": now}},
        })

    # TASKS (one rolling item + issue item when needed)
    upsert_page(DB_TASKS, "Task Name", "Chunk 2: Firestore typed helpers + Lobby", {
        "Status": {"select": {"name": "In Progress"}},
        "Logs": {"rich_text": [{"text": {"content": f"Agents: {agents_summary}; Sessions: {sessions_summary}"}}]},
        "Result": {"rich_text": [{"text": {"content": "In development"}}]},
        "AI Evaluation": {"rich_text": [{"text": {"content": "On track, but needs rapid commit cadence."}}]},
    })

    if isinstance(cpu, (int, float)) and cpu > 85:
        upsert_page(DB_TASKS, "Task Name", "Issue: High CPU utilization", {
            "Status": {"select": {"name": "Open"}},
            "Logs": {"rich_text": [{"text": {"content": f"CPU={cpu}%"}}]},
            "Result": {"rich_text": [{"text": {"content": "Suggest shifting heavy tasks to helper agent."}}]},
            "AI Evaluation": {"rich_text": [{"text": {"content": "Potential bottleneck detected."}}]},
        })

    # SYSTEM METRICS snapshot
    notion("POST", "/pages", {
        "parent": {"database_id": DB_METRICS},
        "properties": {
            "Machine Name": {"title": [{"text": {"content": host}}]},
            "CPU Usage": {"rich_text": [{"text": {"content": str(cpu)}}]},
            "RAM Usage": {"rich_text": [{"text": {"content": mem}}]},
            "GPU Usage": {"rich_text": [{"text": {"content": str(gpu)}}]},
            "Active Processes": {"rich_text": [{"text": {"content": procs[:1800]}}]},
            "Timestamp": {"date": {"start": now}},
        },
    })

    print("Notion intelligence cycle complete")


if __name__ == "__main__":
    main()
