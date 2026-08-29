#!/usr/bin/env python3
"""Retrieve diverse source comments for an Ogilvy topic candidate."""

from __future__ import annotations

import argparse
import csv
import sys


PREFERRED_TEXT_COLUMNS = ("评论", "评论内容", "comment", "content", "正文", "text", "note-text")


def main() -> None:
    parser = argparse.ArgumentParser(description="Search source rows by topic keywords.")
    parser.add_argument("--input", required=True, help="Original CSV file")
    parser.add_argument("--keywords", required=True, help="Comma-separated keywords")
    parser.add_argument("--text-col", default="", help="Text column; inferred when omitted")
    parser.add_argument("--max", type=int, default=50, help="Maximum unique results")
    args = parser.parse_args()

    keywords = [word.strip() for word in args.keywords.replace("，", ",").split(",") if word.strip()]
    if not keywords:
        raise ValueError("Pass at least one keyword.")

    results: list[tuple[int, str, str]] = []
    with open(args.input, encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        columns = reader.fieldnames or []
        text_col = args.text_col or next((name for name in PREFERRED_TEXT_COLUMNS if name in columns), "")
        if not text_col:
            raise ValueError(f"No text column found. Available columns: {', '.join(columns)}")
        if text_col not in columns:
            raise ValueError(f"Text column '{text_col}' is absent. Available: {', '.join(columns)}")
        for row_number, row in enumerate(reader, start=2):
            comment = (row.get(text_col) or "").strip()
            if len(comment) < 8:
                continue
            score = sum(keyword in comment for keyword in keywords)
            if score:
                results.append((score, f"S-{row_number:06d}", comment))

    results.sort(key=lambda item: item[0], reverse=True)
    seen: set[str] = set()
    unique = []
    for result in results:
        if result[2] in seen:
            continue
        seen.add(result[2])
        unique.append(result)
        if len(unique) >= args.max:
            break

    for rank, (score, source_id, comment) in enumerate(unique, start=1):
        print(f"[{rank}] {source_id} (匹配{score}词) {comment}")
    print(f"\n共找到 {len(unique)} 条去重评论（从 {len(results)} 条匹配中筛选）", file=sys.stderr)


if __name__ == "__main__":
    main()
