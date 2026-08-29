#!/usr/bin/env python3
"""
Extract lightweight word frequencies for GWTB analysis.

Usage:
  <python-runner> scripts/extract_wordfreq.py input.csv --text-cols 标题,正文 --group-col 品牌 --top 50
  <python-runner> scripts/extract_wordfreq.py input.txt --top 80

The script intentionally keeps NLP simple. It produces evidence anchors for the
agent's strategy judgment; it does not decide GWTB conclusions by itself.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

try:
    import jieba
except ImportError:
    jieba = None


DEFAULT_STOPWORDS = {
    "一个",
    "一下",
    "一些",
    "这个",
    "那个",
    "这些",
    "那些",
    "自己",
    "我们",
    "你们",
    "他们",
    "就是",
    "不是",
    "还是",
    "已经",
    "因为",
    "所以",
    "但是",
    "然后",
    "可以",
    "真的",
    "感觉",
    "分享",
    "推荐",
    "小红书",
    "笔记",
    "评论",
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "you",
    "your",
}


TOKEN_RE = re.compile(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_+-]{1,}|\d+(?:\.\d+)?")


def split_arg(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in re.split(r"[,，]", value) if part.strip()]


def load_stopwords(path: str | None) -> set[str]:
    words = set(DEFAULT_STOPWORDS)
    if path:
        with open(path, "r", encoding="utf-8") as f:
            words.update(line.strip() for line in f if line.strip() and not line.startswith("#"))
    return words


def tokenize(text: str, stopwords: set[str], min_len: int) -> list[str]:
    tokens = []
    normalized = text.lower()
    raw_tokens: list[str] = []
    if jieba is not None:
        raw_tokens.extend(jieba.lcut(normalized))
    else:
        for raw in TOKEN_RE.findall(normalized):
            if re.fullmatch(r"[\u4e00-\u9fff]+", raw) and len(raw) > 4:
                raw_tokens.extend(raw[index:index + 2] for index in range(len(raw) - 1))
            else:
                raw_tokens.append(raw)
    for raw in raw_tokens:
        token = raw.strip()
        if len(token) < min_len:
            continue
        if token.isdigit():
            continue
        if not TOKEN_RE.fullmatch(token):
            continue
        if token in stopwords:
            continue
        tokens.append(token)
    return tokens


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_json_rows(path: Path) -> list[dict[str, object]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        for key in ("data", "rows", "items", "notes", "comments"):
            rows = data.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
    raise ValueError("JSON input must be a list of objects or contain data/rows/items/notes/comments.")


def infer_text_cols(rows: list[dict[str, object]]) -> list[str]:
    if not rows:
        return []
    preferred = [
        "标题",
        "title",
        "笔记标题",
        "正文",
        "内容",
        "笔记内容",
        "text",
        "content",
        "评论",
        "comment",
        "评论内容",
    ]
    keys = list(rows[0].keys())
    primary = [col for col in preferred[:-3] if col in keys]
    if primary:
        return primary
    found = [col for col in preferred[-3:] if col in keys]
    if found:
        return found
    return [key for key in keys if any(word in key.lower() for word in ("title", "text", "content", "comment"))]


def row_text(row: dict[str, object], cols: list[str]) -> str:
    parts = []
    for col in cols:
        value = row.get(col, "")
        if value is None:
            continue
        parts.append(str(value))
    return "\n".join(parts)


def count_rows(
    rows: list[dict[str, object]],
    text_cols: list[str],
    group_col: str | None,
    stopwords: set[str],
    min_len: int,
) -> dict[str, Counter[str]]:
    counters: dict[str, Counter[str]] = defaultdict(Counter)
    for row in rows:
        group = "ALL"
        if group_col:
            group = str(row.get(group_col) or "UNKNOWN")
        counters[group].update(tokenize(row_text(row, text_cols), stopwords, min_len))
    return counters


def count_text_file(path: Path, stopwords: set[str], min_len: int) -> dict[str, Counter[str]]:
    text = path.read_text(encoding="utf-8")
    return {"ALL": Counter(tokenize(text, stopwords, min_len))}


def render_markdown(counters: dict[str, Counter[str]], top: int) -> str:
    lines = ["# 高频词提取结果", ""]
    for group, counter in counters.items():
        lines.append(f"## {group}")
        lines.append("")
        if not counter:
            lines.append("_无可统计词频_")
            lines.append("")
            continue
        for word, count in counter.most_common(top):
            lines.append(f"- {word}: {count}")
        lines.append("")
    return "\n".join(lines)


def write_csv(counters: dict[str, Counter[str]], top: int, output: Path) -> None:
    with open(output, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["group", "word", "count"])
        for group, counter in counters.items():
            for word, count in counter.most_common(top):
                writer.writerow([group, word, count])


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract simple word frequencies for GWTB evidence.")
    parser.add_argument("input", help="Input .csv, .json, .jsonl, or .txt file")
    parser.add_argument("--text-cols", default="", help="Comma-separated text columns. Auto-detect if omitted.")
    parser.add_argument("--group-col", default="", help="Optional grouping column, usually brand name.")
    parser.add_argument("--top", type=int, default=50, help="Top words per group")
    parser.add_argument("--min-len", type=int, default=2, help="Minimum token length")
    parser.add_argument("--stopwords", default="", help="Optional stopword file, one word per line")
    parser.add_argument("--csv-out", default="", help="Optional CSV output path")
    args = parser.parse_args()

    path = Path(args.input)
    stopwords = load_stopwords(args.stopwords or None)
    suffix = path.suffix.lower()

    if suffix == ".txt":
        counters = count_text_file(path, stopwords, args.min_len)
    elif suffix == ".csv":
        rows = read_csv_rows(path)
        text_cols = split_arg(args.text_cols) or infer_text_cols(rows)
        if not text_cols:
            raise ValueError("No text columns found. Pass --text-cols.")
        available = set(rows[0].keys()) if rows else set()
        missing = [column for column in text_cols if column not in available]
        if missing:
            raise ValueError(f"Text columns absent: {', '.join(missing)}. Available: {', '.join(sorted(available))}")
        if args.group_col and args.group_col not in available:
            raise ValueError(f"Group column '{args.group_col}' is absent. Available: {', '.join(sorted(available))}")
        counters = count_rows(rows, text_cols, args.group_col or None, stopwords, args.min_len)
    elif suffix in {".json", ".jsonl"}:
        if suffix == ".jsonl":
            rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
        else:
            rows = read_json_rows(path)
        text_cols = split_arg(args.text_cols) or infer_text_cols(rows)
        if not text_cols:
            raise ValueError("No text columns found. Pass --text-cols.")
        available = set(rows[0].keys()) if rows else set()
        missing = [column for column in text_cols if column not in available]
        if missing:
            raise ValueError(f"Text columns absent: {', '.join(missing)}. Available: {', '.join(sorted(available))}")
        if args.group_col and args.group_col not in available:
            raise ValueError(f"Group column '{args.group_col}' is absent. Available: {', '.join(sorted(available))}")
        counters = count_rows(rows, text_cols, args.group_col or None, stopwords, args.min_len)
    else:
        raise ValueError("Unsupported input type. Use .csv, .json, .jsonl, or .txt.")

    if args.csv_out:
        write_csv(counters, args.top, Path(args.csv_out))
    print(render_markdown(counters, args.top))


if __name__ == "__main__":
    main()
