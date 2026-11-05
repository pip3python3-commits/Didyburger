#!/usr/bin/env python3
"""Story JSON -> per-beat Kokoro-ONNX TTS -> word timings -> SFX -> master audio + timeline.json.

Usage:
  python pipeline/tts.py --story story/molasses.json --out build
  python pipeline/tts.py --story story/molasses.json --out build --dry-run   # no TTS, estimated timings (renderer testing)
"""
import argparse
import difflib
import json
import os
import re
import sys
import urllib.request
import wave

import numpy as np
from scipy.signal import lfilter, resample_poly

SR = 24000
REL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL = "kokoro-v1.0.onnx"
VOICES = "voices-v1.0.bin"


# ----------------------------------------------------------------------------- helpers
def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    print(f"downloading {url}", flush=True)
    urllib.request.urlretrieve(url, dest)


def write_wav(path, x, sr=SR):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def trim_bounds(x, thresh=0.01):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return 0, len(x)
    return int(idx[0]), int(idx[-1])


# ----------------------------------------------------------------------------- word timing
def proportional_times(words, t0, t1):
    weights = np.array([max(2, len(norm(w))) + (3 if re.search(r"[.,;:!?]$", w) else 0) for w in words], float)
    edges = np.concatenate([[0], np.cumsum(weights)]) / weights.sum()
    return [(t0 + (t1 - t0) * edges[i], t0 + (t1 - t0) * edges[i + 1]) for i in range(len(words))]


def whisper_times(model, audio24k, words, voiced0, voiced1):
    """Align known words to faster-whisper word timestamps; interpolate where unmatched."""
    audio16k = resample_poly(audio24k, 2, 3).astype(np.float32)   # numpy input: no PyAV/ffmpeg decode needed
    try:
        segs, _ = model.transcribe(audio16k, word_timestamps=True, language="en", beam_size=1, vad_filter=False)
        segs = list(segs)
    except Exception as e:
        print(f"[warn] whisper failed ({type(e).__name__}: {e}); proportional timing", file=sys.stderr)
        return proportional_times(words, voiced0, voiced1)
    heard = [(norm(w.word), w.start, w.end) for s in segs for w in s.words if norm(w.word)]
    if not heard:
        return proportional_times(words, voiced0, voiced1)
    a = [norm(w) for w in words]
    b = [h[0] for h in heard]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    times = [None] * len(words)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
    # interpolate gaps between anchored words
    anchors = [i for i, t in enumerate(times) if t]
    if not anchors:
        return proportional_times(words, voiced0, voiced1)
    prev_end, prev_i = voiced0, -1
    bounds = anchors + [len(words)]
    for ai in bounds:
        nxt_start = times[ai][0] if ai < len(words) else voiced1
        gap = list(range(prev_i + 1, ai))
        if gap:
            seg = proportional_times([words[g] for g in gap], prev_end, nxt_start)
            for g, s in zip(gap, seg):
                times[g] = s
        if ai < len(words):
            prev_end, prev_i = times[ai][1], ai
    return times


def make_chunks(words, times, voice_end):
    """Group words into 1-2 word caption chunks (break on punctuation)."""
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        short = all(len(norm(words[j])) <= 3 for j in cur)
        limit = 3 if short else 2
        if re.search(r"[.,;:!?]$", w) or len(cur) >= limit:
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    out = []
    for ci, idxs in enumerate(chunks):
        s = times[idxs[0]][0]
        e = times[chunks[ci + 1][0]][0] if ci + 1 < len(chunks) else voice_end
        out.append({"text": " ".join(words[j] for j in idxs), "s": round(max(0, s - 0.03), 3), "e": round(max(e, s + 0.2), 3)})
    # make chunks butt up (hold the word until the next one starts)
    for i in range(len(out) - 1):
        out[i]["e"] = out[i + 1]["s"]
    return out


def loudness_env(x, times, lead, dry):
    """Mouth-open envelope at 30 Hz, beat-relative (index i = time i/30 s). Drives lip-sync in the renderer."""
    fps = 30
    n = int((lead + len(x) / SR) * fps) + 2
    out = np.zeros(n)
    if dry:
        for s, e in times:   # fake syllable bumps from word timings
            for i in range(int(s * fps), min(n, int(e * fps) + 1)):
                u = (i / fps - s) / max(0.05, e - s)
                out[i] = max(out[i], abs(np.sin(np.pi * u * max(1, round((e - s) / 0.18)))))
    else:
        hop = SR // fps
        rms = np.array([np.sqrt(np.mean(x[k:k + hop] ** 2)) if k < len(x) else 0 for k in range(0, len(x), hop)])
        ref = np.percentile(rms[rms > 1e-4], 95) if np.any(rms > 1e-4) else 1
        v = np.clip(rms / max(ref, 1e-6), 0, 1) ** 0.7
        o = int(lead * fps)
        out[o:o + len(v)] = v[: max(0, n - o)]
    return [round(float(v), 2) for v in out]


# ----------------------------------------------------------------------------- SFX synth
rng = np.random.default_rng(7)


def env(n, a=0.005, d=None, curve=3.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-curve * t / (d if d else n / SR))
    return e


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], x)


def hp(x, fc):
    return x - lp(x, fc)


def sfx(kind, dur=None):
    if kind == "pop":
        n = int(0.18 * SR); t = np.arange(n) / SR
        f = 900 * np.exp(-t * 28) + 120
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.08, 4)
        x += hp(rng.standard_normal(n), 2000) * np.exp(-t * 90) * 0.5
        return x
    if kind == "thud":
        n = int(0.5 * SR); t = np.arange(n) / SR
        f = 90 * np.exp(-t * 6) + 35
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.3, 5) + lp(rng.standard_normal(n), 300) * np.exp(-t * 15) * 0.6
    if kind == "boom":
        n = int(1.8 * SR); t = np.arange(n) / SR
        f = 70 * np.exp(-t * 2.5) + 28
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 1.2, 3.5)
        x += lp(rng.standard_normal(n), 900) * np.exp(-t * 4) * 1.0
        x += hp(rng.standard_normal(n), 3000) * np.exp(-t * 25) * 0.4
        return x * 1.2
    if kind == "rumble":
        n = int((dur or 3) * SR); t = np.arange(n) / SR
        x = lp(rng.standard_normal(n), 120) * 6
        x += np.sin(2 * np.pi * 42 * t) * 0.4 + np.sin(2 * np.pi * 57 * t) * 0.3
        x *= (1 + 0.3 * np.sin(2 * np.pi * 7 * t))
        fade = np.minimum(1, t / 0.3) * np.minimum(1, (n / SR - t) / 0.5)
        return x * fade * 0.55
    if kind == "whoosh":
        n = int((dur or 1) * SR); t = np.arange(n) / SR
        x = rng.standard_normal(n)
        # sweep a lowpass up then down using block filtering
        out = np.zeros(n); blk = 1024
        for i in range(0, n, blk):
            ph = i / n
            fc = 300 + 3500 * np.sin(np.pi * ph) ** 1.5
            out[i:i + blk] = lp(x[i:i + blk], fc)
        return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5 * 2.2
    if kind == "riser":
        n = int((dur or 3) * SR); t = np.arange(n) / SR
        f = 120 + 520 * (t / (n / SR)) ** 2
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + lp(rng.standard_normal(n), 1800) * 0.25 * (t / (n / SR))
        return x * np.minimum(1, t / 0.4) * np.minimum(1, (n / SR - t) / 0.2)
    if kind == "creak":
        n = int((dur or 1.4) * SR); t = np.arange(n) / SR
        f = 95 + 25 * np.sin(2 * np.pi * 3.1 * t) + 30 * (t / (n / SR))
        saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
        x = lp(saw, 700) * 0.6 + lp(rng.standard_normal(n), 400) * 0.4
        return x * np.minimum(1, t / 0.15) * np.minimum(1, (n / SR - t) / 0.3)
    if kind == "slosh":
        n = int((dur or 0.6) * SR); t = np.arange(n) / SR
        x = rng.standard_normal(n); out = np.zeros(n); blk = 512
        for i in range(0, n, blk):
            fc = 1400 * np.exp(-3 * i / n) + 150
            out[i:i + blk] = lp(x[i:i + blk], fc)
        return out * np.sin(np.pi * np.linspace(0, 1, n)) * 2.0
    if kind == "drip":
        n = int(0.25 * SR); t = np.arange(n) / SR
        f = 1400 - 900 * np.minimum(1, t / 0.08)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.1, 5) * 0.8
    if kind == "gavel":
        n = int(0.35 * SR); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * np.cumsum(180 * np.exp(-t * 12) + 90) / SR) * env(n, 0.001, 0.12, 5)
        x += hp(rng.standard_normal(n), 1200) * np.exp(-t * 80) * 0.7
        return x * 1.3
    if kind == "stamp":
        a = sfx("thud"); b = hp(rng.standard_normal(len(a)), 1500) * np.exp(-np.arange(len(a)) / SR * 60) * 0.5
        return a + b
    if kind == "ding":
        n = int(1.2 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1318 * t) + 0.4 * np.sin(2 * np.pi * 2637 * t)) * env(n, 0.002, 0.8, 5) * 0.35
    raise ValueError(kind)


def mix_in(buf, x, at_s, vol):
    i = int(at_s * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i] * vol
    buf[i:i + len(x)] += x


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--story", required=True)
    ap.add_argument("--out", default="build")
    ap.add_argument("--models", default="models")
    ap.add_argument("--dry-run", action="store_true", help="skip TTS/whisper, estimate durations from word count")
    ap.add_argument("--whisper", default="base.en")
    args = ap.parse_args()

    story = json.load(open(args.story))
    # ---- resolve output format preset (short 9:16 / long 16:9) -> story["format"]
    presets = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "formats.json")))
    f = story.get("format", "short")
    fmt = dict(presets[f]) if isinstance(f, str) else {**presets[f.get("preset", "short")], **f}
    story["format"] = fmt
    story["fps"] = fmt["fps"]
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(os.path.join(args.out, "voice"), exist_ok=True)
    beats = story["beats"]

    kokoro = whisper = None
    if not args.dry_run:
        from kokoro_onnx import Kokoro
        download(REL + MODEL, os.path.join(args.models, MODEL))
        download(REL + VOICES, os.path.join(args.models, VOICES))
        kokoro = Kokoro(os.path.join(args.models, MODEL), os.path.join(args.models, VOICES))
        try:
            from faster_whisper import WhisperModel
            whisper = WhisperModel(args.whisper, device="cpu", compute_type="int8")
        except Exception as e:  # whisper is optional: fall back to proportional timing
            print(f"[warn] faster-whisper unavailable ({e}); using proportional word timing", file=sys.stderr)

    LEAD = 0.10
    t_cursor = 0.0
    voices = []
    for b in beats:
        words = b["narration"].split()
        if len(words) > 45:
            print(f"[warn] beat '{b['id']}' has {len(words)} words; Kokoro may truncate long inputs. Split it.", file=sys.stderr)
        if args.dry_run:
            n = int(len(words) / 2.7 * SR)
            x = np.zeros(n, np.float32)
        else:
            x, sr = kokoro.create(b["narration"], voice=b.get("voice", story.get("voice", "af_heart")), speed=b.get("speed", story.get("speed", 1.05)), lang=b.get("lang", story.get("lang", "en-us")))
            assert sr == SR, sr
            x = np.asarray(x, np.float32)
        s0, s1 = trim_bounds(x) if not args.dry_run else (0, len(x))
        x = x[max(0, s0 - int(0.03 * SR)): s1 + int(0.08 * SR)] if not args.dry_run else x
        vdur = len(x) / SR
        wav_path = os.path.join(args.out, "voice", f"{b['id']}.wav")
        if not args.dry_run:
            write_wav(wav_path, x)
        if whisper is not None:
            times = whisper_times(whisper, x, words, 0.03, vdur - 0.08)
        else:
            times = proportional_times(words, 0.03, max(0.2, vdur - 0.08))
        # shift word times into beat-relative time (add LEAD)
        times = [(s + LEAD, e + LEAD) for s, e in times]
        dur = LEAD + vdur + b.get("pad", 0.35)
        voices.append((t_cursor + LEAD, x))
        b["start"] = round(t_cursor, 4)
        b["dur"] = round(dur, 4)
        b["voiceDur"] = round(vdur, 4)
        b["words"] = [{"w": w, "s": round(s, 3), "e": round(e, 3)} for w, (s, e) in zip(words, times)]
        b["chunks"] = make_chunks(words, times, LEAD + vdur)
        b["env"] = loudness_env(x, times, LEAD, args.dry_run)
        t_cursor += dur
        print(f"[{b['id']:>10}] start {b['start']:6.2f}s  dur {b['dur']:5.2f}s  words {len(words)}", flush=True)

    total = t_cursor
    buf = np.zeros(int((total + 0.5) * SR), np.float32)
    for st, x in voices:
        mix_in(buf, x, st, 1.0)
    for b in beats:
        for e in b.get("sfx", []):
            at = b["start"] + e.get("at", 0) * b["dur"]
            mix_in(buf, sfx(e["type"], e.get("dur")).astype(np.float32), at, e.get("vol", 0.6) * 0.45)
    buf = np.tanh(buf * 1.1) * 0.95
    write_wav(os.path.join(args.out, "audio.wav"), buf)

    story["duration"] = round(total + 0.2, 3)
    json.dump(story, open(os.path.join(args.out, "timeline.json"), "w"), indent=1)
    print(f"total {total:.2f}s -> {args.out}/timeline.json, {args.out}/audio.wav")


if __name__ == "__main__":
    main()
