#!/usr/bin/env python3
"""Auto-director: compile a compact episode script (.ep) into a full storyboard (story.json) for the lab set.

  python3 scripts/direct.py episodes/ep01.ep -o story/ep01.json

Script format (one beat per spoken line; long lines are split at sentences automatically):
  title: Episode 1 | What Is an Embedded System?        (episode title card on the first beat)
  narrator: bf_emma en-gb                              (narrator voice + lang)
  cast: ada=engineer:af_heart, ben=worker:am_michael, cy=boss:bm_george:en-gb
  ---
  # Chapter title | subtitle      -> chapter card on the next spoken line, new grade/colour world, whip cut
  @zone screen|bench|green        -> where the cast stands (default screen)
  @grade labWarm                  -> override grade (until the next chapter)
  @world droop=0>1                -> world keys for the next spoken line (value or from>to); carry forward
  %<type> Title [k=v ...]         -> a visual on the wall screen, revealed on the next line, then held
     - item lines / | code lines / bits/names/hl/label/xl lines (see parse_visual)
  %clear                          -> back to the logo screen
  N: text                         -> narrator voice; camera on the screen (if a visual is up) or the room
  N@ben!: text                    -> narrator voice, camera on ben, ben does the mood
  ada: text  / ada!: / ada?: ...  -> character speaks in their own voice
  mood suffix: ! shock  ? worried  ^ cheer  ~ smug  > point  _ sad  # panic  & sweat  . neutral   (default: explain)
"""
import json, re, sys, argparse, os

MOODS = {  # suffix -> (anim, face)
    "": ("present", "smile"), "!": ("shock", "shock"), "?": ("idle", "worried"), "^": ("wave", "grin"), "~": ("smug", "smug"),
    ">": ("point", "smile"), "_": ("dejected", "sad"), "#": ("panic", "panic"), "&": ("sweat", "sweat"), ".": ("idle", "neutral"),
}
LISTEN = {"!": ("idle", "worried"), "#": ("cower", "worried"), "^": ("idle", "grin"), "~": ("idle", "neutral"), "_": ("idle", "sad"), "&": ("idle", "worried")}
# marks per zone: slot -> (pos, rot)
ZONES = {
    "screen": [([-9.8, 0, -9.0], 28), ([9.8, 0, -9.0], -28), ([13.2, 0, -5.4], -38)],
    "bench":  [([-19.0, 0, -8.2], 12), ([-15.2, 0, -7.8], -12), ([-11.8, 0, -5.6], -38)],
    "green":  [([14.6, 0, -7.4], 18), ([19.6, 0, -6.8], -20), ([10.8, 0, -4.8], 30)],
}
ZONE_FOCUS = {"screen": [0, 0, -9], "bench": [-16.5, 0, -9], "green": [17, 0, -8.5]}
PALETTES = [  # chapter colour worlds (grade + walls/floor/accent)
    ("labTeal", {"wall": "#4f8f88", "floor": "#9aa4b4", "accent": "#f29a3a"}),
    ("labWarm", {"wall": "#b88a6a", "floor": "#a89a8a", "accent": "#3ec1a8"}),
    ("labBlue", {"wall": "#4a64b0", "floor": "#9a9ab4", "accent": "#f2d04a"}),
    ("labMint", {"wall": "#5aa874", "floor": "#a8a49a", "accent": "#ef6f9a"}),
    ("labPlum", {"wall": "#8a4a8e", "floor": "#a496a8", "accent": "#7fd36b"}),
    ("labTeal", {"wall": "#c9a860", "floor": "#a89888", "accent": "#4a8fe8"}),
    ("labNight", {"wall": "#3a3a7a", "floor": "#7a7a96", "accent": "#f29a3a"}),
]
SCREEN_CAMS = [  # screen close-ups (raw cams; fov gets multiplied by the format's fovScale 0.8)
    {"from": {"p": [0, 7.5, 4.6], "t": [0, 7.4, -14], "fov": 40}, "to": {"p": [0, 7.5, 3.0], "t": [0, 7.45, -14], "fov": 40}, "ease": "inOut", "shake": 0.0},
    {"from": {"p": [-2.2, 7.2, 4.2], "t": [0, 7.4, -14], "fov": 40}, "to": {"p": [1.6, 7.4, 3.6], "t": [0, 7.4, -14], "fov": 40}, "ease": "inOut", "shake": 0.0},
]


def parse_kv(s):
    out = {}
    for m in re.finditer(r"(\w+)=(\S+)", s):
        k, v = m.group(1), m.group(2)
        try: v = json.loads(v)
        except Exception: pass
        out[k] = v
    return out


def parse_visual(head, body):
    m = re.match(r"%(\w+)\s*(.*)$", head)
    t, rest = m.group(1), m.group(2)
    kv = parse_kv(rest); title = re.sub(r"\s*\b\w+=\S+", "", rest).strip()
    v = {"t": t}
    if title: v["title"] = title
    v.update({k: kv[k] for k in kv})
    items = [b[2:].rstrip() if b.startswith("- ") else b for b in body]
    if t == "big":
        parts = [x.strip() for x in rest.split("|")]
        v = {"t": "big", "text": parts[0].replace("\\n", "\n")}
        if len(parts) > 1: v["sub"] = parts[1]
    elif t == "list":
        v["items"] = items
    elif t == "code":
        v["lines"] = [b[2:] if b.startswith("| ") else b[1:] if b.startswith("|") else b for b in body]
    elif t in ("blocks", "states"):
        nodes = []
        for it in items:
            name, _, tos = it.partition(" > ")
            name = name.replace("\\n", "\n").strip()
            nd = {"name": name}
            pm = re.search(r"\s@([\d.]+),([\d.]+)$", name)
            if pm: nd["pos"] = [float(pm.group(1)), float(pm.group(2))]; nd["name"] = name[:pm.start()].strip()
            sm = re.search(r"\s\(([^)]*)\)$", nd["name"])
            if sm and t == "blocks": nd["sub"] = sm.group(1); nd["name"] = nd["name"][:sm.start()].strip()
            edges = []
            for e in [x.strip() for x in tos.split(",") if x.strip()]:
                both = e.startswith("<>"); e = e[2:].strip() if both else e
                n2, _, lab = e.partition(":")
                d = {"n": n2.strip().replace("\\n", "\n")}
                if lab.strip(): d["label"] = lab.strip()
                if both: d["both"] = True
                edges.append(d)
            if edges: nd["to"] = edges
            nodes.append(nd)
        v["nodes" if t == "blocks" else "states"] = nodes
    elif t == "layers":
        L = []
        for it in items:
            name, _, sub = it.partition(" | ")
            d = {"name": name.strip()}
            if sub.strip(): d["sub"] = sub.strip()
            L.append(d)
        v["items"] = L
    elif t == "timing":
        rows = []
        for it in items:
            name, _, w = it.partition(":")
            w = w.strip(); labs = None
            if " " in w: w, labs = w.split(" ", 1)
            r = {"name": name.strip(), "wave": w}
            if labs: r["labels"] = [x.strip() for x in labs.split(",")]
            rows.append(r)
        v["rows"] = rows
    elif t == "memory":
        R = []
        for it in items:
            f = [x.strip() for x in it.split("|")] + ["", "", "", ""]
            d = {"addr": f[0], "name": f[1], "size": float(f[2] or 1)}
            if f[3]: d["note"] = f[3]
            R.append(d)
        v["regions"] = R
    elif t == "bits":
        for it in items:
            k, _, val = it.partition(" ")
            if k == "bits": v["bits"] = val.strip()
            elif k == "names": v["names"] = [x.strip() for x in val.split(",")]
            elif k == "hl": v["hl"] = [int(x) for x in val.split(",")]
            elif k == "label": v["label"] = val.strip()
    elif t == "chart":
        S = []
        for it in items:
            if it.startswith("xl "): v["xl"] = [x.strip() for x in it[3:].split(",")]; continue
            if it.startswith("yl "): v["yl"] = it[3:].strip(); continue
            kind, _, rest2 = it.partition(" ")
            name, _, vals = rest2.partition(":")
            S.append({"type": kind, "name": name.strip(), "v": [float(x) for x in vals.split(",")]})
        v["series"] = S
    elif t == "table":
        v["rows"] = [[c.strip() for c in it.split("|")] for it in items]
    else:
        raise SystemExit(f"unknown visual type %{t}")
    return v


def split_text(text, maxw=30):
    words = text.split()
    if len(words) <= maxw: return [text]
    sents = re.split(r"(?<=[.!?;])\s+", text)
    out, cur = [], ""
    for s in sents:
        if cur and len((cur + " " + s).split()) > maxw: out.append(cur); cur = s
        else: cur = (cur + " " + s).strip()
    if cur: out.append(cur)
    res = []
    for o in out:  # still too long: split at commas / halves
        w = o.split()
        while len(w) > 40: res.append(" ".join(w[:28])); w = w[28:]
        res.append(" ".join(w))
    return res


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("-o", "--out", required=True); ap.add_argument("--prefix", default=None)
    a = ap.parse_args()
    raw = open(a.src, encoding="utf8").read()
    head, _, body = raw.partition("\n---\n")
    meta = {}
    for ln in head.splitlines():
        if ":" in ln and not ln.strip().startswith("#"):
            k, _, v = ln.partition(":"); meta[k.strip()] = v.strip()
    prefix = a.prefix or os.path.splitext(os.path.basename(a.src))[0]
    nvoice, *nl = meta.get("narrator", "bf_emma en-gb").split(); nlang = nl[0] if nl else "en-us"
    cast, voices, order = {}, {}, []
    for c in meta["cast"].split(","):
        cid, _, spec = c.strip().partition("=")
        parts = spec.split(":")
        cast[cid] = {"type": parts[0]}; order.append(cid)
        voices[cid] = (parts[1] if len(parts) > 1 else "af_heart", parts[2] if len(parts) > 2 else "en-us")
    title = [x.strip() for x in meta.get("title", "").split("|")]

    beats = []
    zone, chap_i, pal = "screen", -1, PALETTES[0]
    grade_override = None
    pending_title = {"text": title[0], "sub": title[1] if len(title) > 1 else "", "dur": 3.4} if title[0] else None
    pending_world, visual, vis_new, vis_count = {}, None, False, 0
    shot_i, lines = 0, body.splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip(); i += 1
        if not ln.strip() or ln.startswith("//"): continue
        if ln.startswith("# "):
            parts = [x.strip() for x in ln[2:].split("|")]
            if parts[0].startswith("Chapter "):
                NUM = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"]
                nchap = sum(1 for b in beats if b.get("title", {}).get("text", "").startswith("Chapter ")) + (1 if pending_title and pending_title["text"].startswith("Chapter ") else 0)
                parts[0] = "Chapter " + NUM[min(nchap, 14)]
            pending_title = {"text": parts[0], "sub": parts[1] if len(parts) > 1 else "", "dur": 2.8}
            visual = None; chap_i += 1; pal = PALETTES[(chap_i + sum(map(ord, prefix)) % 3) % len(PALETTES)]; grade_override = None
            continue
        if ln.startswith("@zone"): zone = ln.split()[1]; continue
        if ln.startswith("@grade"): grade_override = ln.split()[1]; continue
        if ln.startswith("@world"):
            for k, v in parse_kv(ln).items():
                if isinstance(v, str) and ">" in v: f, t = v.split(">"); pending_world[k] = [float(f), float(t)]
                else: pending_world[k] = float(v)
            continue
        if ln.startswith("%clear"): visual = None; continue
        if ln.startswith("%"):
            bl = []
            while i < len(lines) and (lines[i].startswith("- ") or lines[i].startswith("|") or re.match(r"^(bits|names|hl|label|xl|yl) ", lines[i])):
                bl.append(lines[i].rstrip()); i += 1
            visual = parse_visual(ln, bl); vis_new = True; vis_count += 1
            continue
        m = re.match(r"^(N|[A-Za-z]+)(?:@([A-Za-z]+))?([!?^~>_#&.*]?):\s*(.+)$", ln)
        if not m: raise SystemExit(f"{a.src}: cannot parse line: {ln!r}")
        who, focus, mood, text = m.group(1), m.group(2), m.group(3) or "", m.group(4)
        if mood == "*": mood = ""
        if who != "N" and who not in cast: raise SystemExit(f"unknown speaker {who}")
        actor = who if who != "N" else focus
        chunks = split_text(text)
        for ci, chunk in enumerate(chunks):
            b = {"id": f"{prefix}_{len(beats) + 1:03d}", "narration": chunk, "set": "lab"}
            vo, lang = (nvoice, nlang) if who == "N" else voices[who]
            b["voice"], b["lang"] = vo, lang
            b["grade"] = grade_override or pal[0]; b["setColors"] = pal[1]
            b["pad"] = 0.3
            sfx = []
            if pending_title and ci == 0:
                b["title"] = pending_title; b["cut"] = "whip"; sfx.append({"at": 0.02, "type": "whoosh", "vol": 0.5, "dur": 0.5}); pending_title = None
            elif mood in ("!", "#") and ci == 0: b["cut"] = "flash"; sfx.append({"at": 0.04, "type": "thud", "vol": 0.6})
            if pending_world and ci == 0: b["world"] = pending_world; pending_world = {}
            # actors at marks
            marks = ZONES.get(zone, ZONES["screen"])
            acts = []
            for si, cid in enumerate(order[:3]):
                pos, rot = marks[si]
                if cid == actor:
                    an, fa = MOODS.get(mood, MOODS[""])
                    if ci > 0 and an in ("shock", "panic"): an = "idle"
                    act = {"id": cid, "pos": pos, "rot": rot, "anim": an, "face": fa}
                    if an == "present" and len(beats) % 3 == 0: act["then"] = [{"at": 0.55, "anim": "point"}]
                else:
                    an, fa = LISTEN.get(mood, ("idle", "neutral" if len(beats) % 4 else "smile"))
                    act = {"id": cid, "pos": pos, "rot": rot, "anim": an, "face": fa}
                acts.append(act)
            b["actors"] = acts
            # visual + camera
            b["visual"] = dict(visual) if visual else {"t": "logo", "text": "SPROUT", "sub": "smart plant waterer"}
            if visual and not (vis_new and ci == 0): b["visual"]["full"] = True
            on_screen = False
            if visual and vis_new and ci == 0:
                b["cam"] = SCREEN_CAMS[vis_count % 2]; on_screen = True; sfx.append({"at": 0.05, "type": "pop", "vol": 0.35})
            elif visual and ((actor is None and shot_i % 2 == 0) or (actor is not None and shot_i % 4 == 1)):
                b["cam"] = SCREEN_CAMS[(shot_i + 1) % 2]; on_screen = True
            elif actor:
                pos, rot = marks[order.index(actor)]
                pattern = ["medium", "close", "medium", "low" if mood in ("^", "!", "~") else "close"]
                st = "low" if mood in ("^",) and shot_i % 2 else pattern[shot_i % 4]
                if mood in ("!", "#"): st = "close"
                mv = ["push", "drift", "orbit", "push", "pull"][shot_i % 5]
                b["shot"] = {"type": st, "f": actor, "az": rot + (8 if shot_i % 2 else -8), "move": mv}
                if mood in ("!", "#"): b["shot"]["shake"] = 0.25
            else:
                f = ZONE_FOCUS.get(zone, [0, 0, -9])
                k = shot_i % 4
                if visual and zone == "screen":   # room shots that keep the screen in view
                    b["shot"] = [{"type": "wide", "f": [0, 0, -10], "az": -18, "move": "drift", "dist": 19, "ty": 5},
                                 {"type": "medium", "f": [-6, 0, -10], "az": 32, "move": "push", "dist": 14, "ty": 5.5},
                                 {"type": "wide", "f": [0, 0, -10], "az": 16, "move": "push", "dist": 20, "ty": 5},
                                 {"type": "medium", "f": [6, 0, -10], "az": -32, "move": "push", "dist": 14, "ty": 5.5}][k]
                else:
                    st = ["wide", "high", "wide", "medium"][k]
                    b["shot"] = {"type": st, "f": f, "az": [-14, 10, 20, -24][k], "move": ["push", "crane", "drift", "orbit"][k]}
                    if st == "wide": b["shot"]["dist"] = 17
                    if st == "medium": b["shot"]["dist"] = 12
            if on_screen: b["paint"] = 0.12
            if mood == "^" and ci == 0: sfx.append({"at": 0.5, "type": "ding", "vol": 0.3})
            if sfx: b["sfx"] = sfx
            shot_i += 1
            beats.append(b)
        vis_new = False

    story = {"title": title[0] + (" - " + title[1] if len(title) > 1 else ""), "format": "long", "voice": nvoice, "lang": nlang, "speed": 1.0,
             "cast": cast, "beats": beats}
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(story, open(a.out, "w"), indent=1)
    words = sum(len(b["narration"].split()) for b in beats)
    print(f"{a.out}: {len(beats)} beats, {words} words, ~{words / 2.6 / 60 + len(beats) * 0.45 / 60:.1f} min, {vis_count} visuals")


if __name__ == "__main__":
    main()
