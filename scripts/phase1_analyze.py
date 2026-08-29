#!/usr/bin/env python3
"""
Ogilvy Phase 1: BERTopic clustering + emotion-signal scanning + MMR sampling.

Usage:
  <workspace-python-runner> phase1_analyze.py <input> <output_dir> --source 小红书 --brand 品牌名
"""
import argparse, csv, random, re, json, sys
from pathlib import Path
from collections import defaultdict
import numpy as np

# ── Optional heavy deps ─────────────────────────────────
try: from sentence_transformers import SentenceTransformer
except ImportError: sys.exit("Install sentence-transformers: pip3 install sentence-transformers")
try: from bertopic import BERTopic
except ImportError: sys.exit("Install bertopic: pip3 install bertopic")
try: from hdbscan import HDBSCAN
except ImportError: sys.exit("Install hdbscan: pip3 install hdbscan")
try: from sklearn.metrics.pairwise import cosine_similarity
except ImportError: sys.exit("Install scikit-learn: pip3 install scikit-learn")

# ── Framework signal dictionaries ───────────────────────

OGILVY_EMOTION_WORDS = {
    "自卑","不自信","迷茫","迷失","找不到自己","不知道我是谁","不配","配不上",
    "真实","做自己","活出自己","人设","标签","定义","别人眼光",
    "压力","累","焦虑","不安","崩溃","撑不住","内卷","卷","加班","996","平衡","兼顾","职场","被淘汰","完美",
    "孤独","寂寞","冷漠","没人理解","无人懂","被忽视","忽略","陪伴","倾听","爱","关心","共情","共鸣","懂我",
    "羡慕","嫉妒","酸","不甘心","后悔","遗憾","自由","束缚","无聊","没意思","平庸","普通",
    "羡慕别人","别人家","精致","仪式感","松弛","从容","慢下来",
    "感动","真诚","共鸣","认同","被看见","被理解","治愈","温暖","勇敢","力量","坚持","突破","成长",
}

# ── Helpers ─────────────────────────────────────────────
def load_comments(path):
    """Load comments from CSV/TSV/TXT. Returns list of dicts."""
    comments = []
    suffix = Path(path).suffix.lower()
    if suffix == '.txt':
        with open(path, encoding='utf-8-sig') as f:
            for line in f:
                t = line.strip()
                if len(t) >= 8:
                    comments.append({'text': t, 'likes': 0})
        return comments
    # CSV/TSV
    delimiter = '\t' if suffix == '.tsv' else ','
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.reader(f, delimiter=delimiter)
        headers = [h.strip() for h in next(reader)]
        col_text = next((i for i, h in enumerate(headers) if h in ('评论内容','评论','内容','content','text','comment')), 0)
        col_likes = next((i for i, h in enumerate(headers) if h in ('点赞数','点赞','赞','likes','like_count')), -1)
        for row in reader:
            t = row[col_text].strip() if col_text < len(row) else ''
            if len(t) >= 8:
                likes = int(row[col_likes]) if col_likes >= 0 and col_likes < len(row) and row[col_likes] else 0
                comments.append({'text': t, 'likes': likes})
    return comments

def mmr_sample(indices, embeddings, n_samples, lambda_param=0.3):
    """Select n_samples diverse items using MMR."""
    if len(indices) <= n_samples:
        return indices
    emb = embeddings[indices]
    centroid = emb.mean(axis=0).reshape(1, -1)
    relevance = cosine_similarity(emb, centroid).flatten()
    selected = [int(np.argmax(relevance))]
    candidates = [i for i in range(len(indices)) if i != selected[0]]
    pairwise = cosine_similarity(emb)
    for _ in range(n_samples - 1):
        if not candidates:
            break
        max_sim = pairwise[candidates][:, selected].max(axis=1)
        scores = lambda_param * relevance[candidates] - (1 - lambda_param) * max_sim
        best = candidates[int(np.argmax(scores))]
        selected.append(best)
        candidates.remove(best)
    return [indices[i] for i in selected]

def scan_ogilvy_signals(texts):
    """Scan texts for Ogilvy emotion signals. Returns set of high-signal indices."""
    emoji_re = re.compile(r'[\U0001F300-\U0001F9FF\U0001FA00-\U0001FAFF☀-➿\U0001F600-\U0001F64F]')
    emotion_z = []
    for i, t in enumerate(texts):
        ed = len(emoji_re.findall(t)) / max(len(t), 1)
        emd = sum(1 for w in OGILVY_EMOTION_WORDS if w in t) / max(len(t), 1)
        emotion_z.append((ed, emd, i))
    z_emoji = np.array([x[0] for x in emotion_z]); z_emoji = (z_emoji - z_emoji.mean()) / (z_emoji.std() + 1e-8)
    z_emotion = np.array([x[1] for x in emotion_z]); z_emotion = (z_emotion - z_emotion.mean()) / (z_emotion.std() + 1e-8)
    emo_thresh = np.percentile(z_emoji, 90); emd_thresh = np.percentile(z_emotion, 90)
    high_emo = set()
    for i in range(len(texts)):
        if z_emoji[i] > emo_thresh or z_emotion[i] > emd_thresh:
            high_emo.add(i)
    return high_emo

# ── Main ────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Ogilvy Phase 1: BERTopic + emotion-signal scanning + MMR sampling")
    parser.add_argument('input', type=Path, help='Comments file (CSV/TSV/TXT)')
    parser.add_argument('output_dir', type=Path, help='Output directory')
    parser.add_argument('--source', default='社媒平台', help='Data source label')
    parser.add_argument('--brand', default='', help='Brand name')
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load
    print(f"Loading {args.input}...")
    comments = load_comments(args.input)
    texts = [c['text'] for c in comments]
    print(f"  {len(texts)} valid comments (≥8 chars)")

    # 2. BERTopic
    print("Computing embeddings...")
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', device='cpu')
    embeddings = model.encode(texts, show_progress_bar=True, batch_size=64)

    print("Clustering with BERTopic...")
    topic_model = BERTopic(
        hdbscan_model=HDBSCAN(min_cluster_size=25, min_samples=5, metric='euclidean',
                               cluster_selection_method='eom', prediction_data=True),
        embedding_model=model, verbose=True, nr_topics='auto', language='multilingual',
    )
    topics, probs = topic_model.fit_transform(texts, embeddings)
    topic_info = topic_model.get_topic_info()
    n_topics = len(topic_info) - 1  # exclude -1
    print(f"  {n_topics} topics discovered")

    # 3. Framework-specific signal scanning
    mmr_indices = set()
    signal_indices = set()
    high_emo = scan_ogilvy_signals(texts)

    # 4. MMR sampling per cluster
    cluster_map = defaultdict(list)
    for i, t in enumerate(topics):
        if t >= 0:
            cluster_map[t].append(i)

    total_budget = 200; signal_budget = 40; cluster_budget = total_budget - signal_budget
    sqrt_sizes = {t: np.sqrt(len(idxs)) for t, idxs in cluster_map.items()}
    total_sqrt = sum(sqrt_sizes.values())

    per_cluster = {}
    for t in cluster_map:
        n = max(4, int(cluster_budget * sqrt_sizes[t] / total_sqrt))
        per_cluster[t] = min(n, len(cluster_map[t]))

    for t, idxs in cluster_map.items():
        sampled = mmr_sample(idxs, embeddings, per_cluster[t], lambda_param=0.3)
        mmr_indices.update(sampled)

    # 5. Signal补漏
    emo_candidates = list(high_emo - mmr_indices)
    n_emo = signal_budget // 2
    emo_picked = mmr_sample(emo_candidates, embeddings, min(n_emo, len(emo_candidates)), 0.1) if emo_candidates else []
    signal_indices = set(emo_picked)
    final = mmr_indices | signal_indices

    # 6. Output
    sample_path = args.output_dir / 'sampled_comments.csv'
    with open(sample_path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        headers_out = ['index', 'topic_cluster', 'source', 'comment']
        w.writerow(headers_out)
        for j, i in enumerate(sorted(final)):
            src = 'signal' if i in signal_indices else 'bertopic_mmr'
            row = [j+1, topics[i], src, texts[i]]
            w.writerow(row)

    meta_path = args.output_dir / 'cluster_metadata.json'
    cluster_meta = []
    for _, row in topic_info.iterrows():
        t = row['Topic']
        if t == -1: continue
        reps = []
        for i in sorted(final):
            if topics[i] == t:
                reps.append(texts[i][:150])
                if len(reps) >= 5: break
        meta = {
            'topic_id': int(t),
            'count': int(row['Count']),
            'name': str(row.get('Name', row.get('CustomName', f'Topic_{t}'))),
            'keywords': str(row.get('Representation', row.get('Name', ''))),
            'sample_comments': reps,
            'framework': 'ogilvy',
        }
        cluster_meta.append(meta)

    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(cluster_meta, f, ensure_ascii=False, indent=2)

    print("\nFramework: ogilvy")
    print(f"Done. Outputs:")
    print(f"  {sample_path}  ({len(final)} sampled comments)")
    print(f"  {meta_path}  ({len(cluster_meta)} cluster metadata)")
    print(f"  {len(texts)} comments → {n_topics} topics → {len(final)} samples "
          f"({len(mmr_indices)} MMR + {len(signal_indices)} signal)")

if __name__ == '__main__':
    main()
