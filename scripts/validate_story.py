#!/usr/bin/env python3
"""Validate a storyboard JSON against what the renderer actually supports (names are read from the source files).
   python scripts/validate_story.py story/story.json [--strict-ci]
Exit code 1 on errors. Warnings never fail the run."""
import json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding="utf8").read()

rig, grades, tts, shots = rd("renderer/src/rig.js"), rd("renderer/src/grades.js"), rd("pipeline/tts.py"), rd("renderer/src/shots.js")
ANIMS = set(re.findall(r"^  (\w+)\(t", rig[rig.index("const ANIMS"):], re.M))
_fp = rig[rig.index("const FACE_PRESETS"):]; _fp = _fp[:_fp.index("\n};")]
FACES = set(re.findall(r"^  (\w+):\s+\{", _fp, re.M)) | {"neutral"}
TYPES = set(re.findall(r"^  (\w+):\s+\{ torso", rig, re.M))
SKINS = set(re.findall(r"(s\d|white): '#", rig))
GESTS = set(re.findall(r"^  (\w+):\s+\{ h[LR]:", rig, re.M))
PROPS = set(re.findall(r"^  (\w+)\(\) \{", rd("renderer/src/props.js"), re.M))
GRADES = set(re.findall(r"^  (\w+):\s+\{ skyTop", grades, re.M))
SFX = set(re.findall(r'kind == "(\w+)"', tts))
HATS = {"flatcap", "cap", "bowler", "wig", "tophat", "topi", "nonla", "visor", "beret", "headscarf", "none"}
HAIR = {"none", "short", "tuft", "curly", "bun"}
SETS = {"street", "court"}
sd = os.path.join(ROOT, "renderer/src/sets")
for f in os.listdir(sd):
    if f.endswith(".js") and f != "index.js":
        SETS |= set(re.findall(r"name:\s*'(\w+)'", open(os.path.join(sd, f)).read()))
SHOT_TYPES = set(re.findall(r"^  (\w+):\s+\{ dist", shots, re.M)); MOVES = {"push", "pull", "orbit", "drift", "crane", "static"}
WORLD_KEYS = {"paint", "leak", "swell", "burst", "waveZ", "flood", "aftermath", "thermo", "rivets", "droop", "protoDroop"}
for f in os.listdir(sd):
    if f.endswith(".js"): WORLD_KEYS |= set(re.findall(r"\bst\.(\w+)", open(os.path.join(sd, f)).read()))
CUTS = {"none", "whip", "flash", "ghost", "iris", "zoom"}
FX_KEYS = {"dust", "rain", "confetti", "coins", "paper", "sparks", "smoke", "steam", "debris", "rays", "raysFrom", "rayCol", "speed", "veins", "chroma", "crack", "impact", "flashCol"}
VIS = set(re.findall(r"^T\.(\w+) =", rd("renderer/src/visuals.js"), re.M))

err, warn = [], []
path = sys.argv[1] if len(sys.argv) > 1 else "story/story.json"
story = json.load(open(path if os.path.isabs(path) or os.path.exists(path) else os.path.join(ROOT, path)))
fmts = json.load(open(os.path.join(ROOT, "pipeline/formats.json")))
f = story.get("format", "short")
fmt = dict(fmts[f]) if isinstance(f, str) else {**fmts[f.get("preset", "short")], **f}
cast = story.get("cast", {})
if not cast: err.append("no cast")
for cid, c in cast.items():
    if c.get("type") not in TYPES: err.append(f"cast '{cid}': unknown type '{c.get('type')}' (valid: {sorted(TYPES)})")
    if c.get("hat") and c["hat"] not in HATS: err.append(f"cast '{cid}': unknown hat '{c['hat']}' (valid: {sorted(HATS)})")
    if c.get("hair") and c["hair"] not in HAIR: err.append(f"cast '{cid}': unknown hair '{c['hair']}' (valid: {sorted(HAIR)})")
    sk = c.get("skin")
    if sk and sk not in SKINS and not re.match(r"^#[0-9a-fA-F]{6}$", str(sk)): err.append(f"cast '{cid}': skin '{sk}' must be one of {sorted(SKINS)} or #rrggbb")
skins = {str(c.get("skin", "")) for c in cast.values()}
if len(cast) >= 3 and len(skins) < 2: warn.append("every cast member has the same (or default) skin tone; quality-bar.md asks for a deliberate, varied palette")

def cam_check(b, c, label):
    if b.get("set") != "street": return
    for k in ("from", "to"):
        x, y, z = c[k]["p"]
        if abs(x) > 10.4 and -17 < z < 137 and y < 19:
            warn.append(f"beat '{b['id']}' {label}.{k}: camera at x={x:.1f},z={z:.1f} is inside a building footprint (street is |x|<10.4 for z>-17)")

ids, words_total, dur = set(), 0, 0.0
for i, b in enumerate(story.get("beats", [])):
    bid = b.get("id", f"#{i}")
    if bid in ids: err.append(f"duplicate beat id '{bid}'")
    ids.add(bid)
    n = len(b.get("narration", "").split()); words_total += n
    if n == 0: err.append(f"beat '{bid}': empty narration")
    if n > 45: warn.append(f"beat '{bid}': {n} words (>45) - split it, Kokoro may truncate")
    dur += n / 2.65 + b.get("pad", 0.35) + 0.1
    if b.get("set") not in SETS: err.append(f"beat '{bid}': unknown set '{b.get('set')}' (valid: {sorted(SETS)})")
    if b.get("grade", "dayCool") not in GRADES: err.append(f"beat '{bid}': unknown grade '{b.get('grade')}' (valid: {sorted(GRADES)})")
    if b.get("cut", "none") not in CUTS: err.append(f"beat '{bid}': unknown cut '{b.get('cut')}'")
    for k in (b.get("world") or {}):
        if k not in WORLD_KEYS: warn.append(f"beat '{bid}': world key '{k}' is not built in (ok if your custom set reads it)")
    if b.get("visual") and b["visual"].get("t") not in VIS: err.append(f"beat '{bid}': unknown visual type '{b['visual'].get('t')}' (valid: {sorted(VIS)})")
    if "cam" not in b and "shot" not in b: err.append(f"beat '{bid}': needs 'cam' or 'shot'")
    if "shot" in b:
        s = b["shot"]
        if s.get("type", "medium") not in SHOT_TYPES: err.append(f"beat '{bid}': unknown shot type '{s.get('type')}' (valid: {sorted(SHOT_TYPES)})")
        if s.get("move", "push") not in MOVES: err.append(f"beat '{bid}': unknown shot move '{s.get('move')}'")
        if isinstance(s.get("f"), str) and s["f"] not in [a.get("id") for a in b.get("actors", [])]: err.append(f"beat '{bid}': shot.f '{s['f']}' is not an actor in this beat")
    if "cam" in b:
        for k in ("from", "to"):
            if k not in b["cam"] or not {"p", "t", "fov"} <= set(b["cam"][k]): err.append(f"beat '{bid}': cam.{k} needs p,t,fov")
        try: cam_check(b, b["cam"], "cam")
        except (KeyError, TypeError): pass
    for a in b.get("actors", []):
        if a.get("id") not in cast: err.append(f"beat '{bid}': actor '{a.get('id')}' not in cast")
        kfs = a.get("tl") or [{"anim": a.get("anim", "idle"), "face": a.get("face", "neutral"), "pos": a.get("pos")}]
        if not a.get("tl") and not a.get("pos"): err.append(f"beat '{bid}': actor '{a.get('id')}' needs pos or tl")
        for k in kfs + list(a.get("then", [])):
            if k.get("anim") and k["anim"] not in ANIMS: err.append(f"beat '{bid}': unknown anim '{k['anim']}' (valid: {sorted(ANIMS)})")
            if k.get("face") and k["face"] not in FACES: err.append(f"beat '{bid}': unknown face '{k['face']}' (valid: {sorted(FACES)})")
    for k in (b.get("fx") or {}):
        if k not in FX_KEYS: err.append(f"beat '{bid}': unknown fx '{k}' (valid: {sorted(FX_KEYS)})")
    tk = b.get("talk") or b.get("speaker")
    if tk and tk not in [a.get("id") for a in b.get("actors", [])]: warn.append(f"beat '{bid}': talk '{tk}' is not an actor in this beat (no lip-sync shown)")
    if b.get("gesture") and b["gesture"] not in GESTS: err.append(f"beat '{bid}': unknown gesture '{b['gesture']}' (valid: {sorted(GESTS)})")
    for a in b.get("actors", []):
        for k in (a.get("tl") or [a]) + list(a.get("then", [])):
            for pk in ("prop", "propL"):
                if k.get(pk) and k[pk] not in PROPS: err.append(f"beat '{bid}': unknown {pk} '{k[pk]}' (valid: {sorted(PROPS)})")
            if k.get("enter") and k["enter"] not in ("pop", "drop"): err.append(f"beat '{bid}': enter must be pop|drop")
    for e in b.get("sfx", []):
        if e.get("type") not in SFX: err.append(f"beat '{bid}': unknown sfx '{e.get('type')}' (valid: {sorted(SFX)})")

fps = fmt["fps"]; frames = math.ceil(dur * fps); shards = max(1, min(250, math.ceil(frames / fmt["framesPerShard"])))
label = f if isinstance(f, str) else f.get("preset", "custom")
print(f"{path}: format={label} {fmt['width']}x{fmt['height']}->{fmt['outWidth']}x{fmt['outHeight']} @ {fps}fps")
print(f"  beats={len(story.get('beats', []))} words={words_total} est. length={dur/60:.1f} min ({dur:.0f}s) frames~{frames} shards~{shards}")
if label == "long" and dur < 14 * 60: warn.append(f"long-form target is ~15+ min but this is ~{dur/60:.1f} min (~{int(15*60*2.65)} words needed)")
if label == "short" and dur > 3 * 60: warn.append(f"short-form is usually <3 min; this is ~{dur/60:.1f} min")
for w in warn: print("  WARN ", w)
for e in err: print("  ERROR", e)
print("OK" if not err else f"{len(err)} error(s)")
sys.exit(1 if err else 0)
