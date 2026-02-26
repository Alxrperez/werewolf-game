#!/usr/bin/env python3
"""
Simple CPU usage monitor.

Usage examples:
  python cpu_monitor.py
  python cpu_monitor.py --interval 2 --warn 85
  python cpu_monitor.py --interval 1 --warn 90 --log cpu.log
"""

from __future__ import annotations

import argparse
import datetime as dt
import time
from pathlib import Path


def read_proc_stat() -> tuple[int, int]:
    """Return (idle_time, total_time) from /proc/stat CPU line."""
    with open("/proc/stat", "r", encoding="utf-8") as f:
        first = f.readline().strip()

    parts = first.split()
    if not parts or parts[0] != "cpu":
        raise RuntimeError("Unexpected /proc/stat format")

    values = [int(x) for x in parts[1:]]
    idle = values[3] + (values[4] if len(values) > 4 else 0)  # idle + iowait
    total = sum(values)
    return idle, total


def cpu_percent(sample_seconds: float = 1.0) -> float:
    """Measure average CPU usage over sample_seconds."""
    idle1, total1 = read_proc_stat()
    time.sleep(sample_seconds)
    idle2, total2 = read_proc_stat()

    idle_delta = idle2 - idle1
    total_delta = total2 - total1
    if total_delta <= 0:
        return 0.0

    usage = 100.0 * (1.0 - (idle_delta / total_delta))
    return max(0.0, min(100.0, usage))


def main() -> None:
    parser = argparse.ArgumentParser(description="Monitor CPU usage continuously")
    parser.add_argument("--interval", type=float, default=1.0, help="Seconds between readings (default: 1)")
    parser.add_argument("--warn", type=float, default=80.0, help="Warn threshold percent (default: 80)")
    parser.add_argument("--log", type=Path, default=None, help="Optional log file path")
    args = parser.parse_args()

    if args.interval <= 0:
        raise SystemExit("--interval must be > 0")

    print(f"Monitoring CPU every {args.interval:g}s (warn at {args.warn:g}%)... Press Ctrl+C to stop.")

    try:
        while True:
            usage = cpu_percent(sample_seconds=args.interval)
            now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            level = "WARN" if usage >= args.warn else "OK"
            line = f"[{now}] CPU: {usage:6.2f}%  {level}"
            print(line)

            if args.log:
                with args.log.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")

    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
