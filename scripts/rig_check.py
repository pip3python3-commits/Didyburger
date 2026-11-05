#!/usr/bin/env python3
"""Pose/leg sanity check. Renders every animation on three different outfits and writes contact sheets you MUST look at before
publishing a video (legs attached to the hips, knees bend forward, feet leave the ground when jumping, no stretched or twisted limbs).
   python3 scripts/rig_check.py            # writes build/rigcheck/sheet_*.png (needs: npm i, Chromium, PIL)
Env: CHROMIUM_PATH=<chrome binary> if Playwright's own browser is not installed."""
import glob, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
rig = open("renderer/src/rig.js", encoding="utf8").read()
anims = re.findall(r"^  (\w+)\(t", rig[rig.index("const ANIMS"):], re.M)
anims = [a for a in anims if a != "talk"]
WALK = {"walk", "run", "sneak", "wade", "panic"}
cast = {"kid": {"type": "kid", "skin": "s4"}, "judge": {"type": "judge", "skin": "s2"}, "farmer": {"type": "farmer", "skin": "s3"}}
beats = []
for i, a in enumerate(anims):
    who = ["kid", "judge", "farmer"][i % 3]; w = a in WALK
    tl = [dict(at=0, anim=a, face="neutral", pos=[-3.2, 0, 0] if w else [0, 0, 0], rot=90 if w else 0)] + ([dict(at=1, pos=[3.2, 0, 0])] if w else [])
    beats.append(dict(id=a, narration=f"Testing the {a} pose on this character right now, so every limb gets checked from the side.", set="studio", grade="dayCool",
                      shot=dict(type="medium", f=[0, 0, 0], dist=10.5, h=1.6, ty=1.9, fov=52, az=0, move="static"), actors=[dict(id=who, tl=tl)], captions=False, fx=dict(dust=0), pad=0.1))
os.makedirs("build/rigcheck", exist_ok=True)
json.dump(dict(title="rig check", format="short", voice="af_heart", cast=cast, beats=beats), open("build/rigcheck/story.json", "w"))
run = lambda *c: subprocess.run(c, check=True)
run(sys.executable, "pipeline/tts.py", "--story", "build/rigcheck/story.json", "--out", "build/rigcheck", "--dry-run")
tl = json.load(open("build/rigcheck/timeline.json"))
times = [f"{b['start'] + b['dur'] * f:.2f}" for b in tl["beats"] for f in (0.2, 0.4, 0.6, 0.8)]
for f in glob.glob("build/rigcheck/still_*.png"): os.remove(f)
run("node", "renderer/render.mjs", "--timeline", "build/rigcheck/timeline.json", "--out", "build/rigcheck", "--stills", ",".join(times), "--width", "360", "--height", "640", "--workers", "4", "--paint", "0")
from PIL import Image, ImageDraw
val = lambda f: float(re.sub(r"still_|\.png", "", os.path.basename(f)).replace("_", "."))
fs = sorted(glob.glob("build/rigcheck/still_*.png"), key=val)
names = [b["id"] for b in tl["beats"] for _ in range(4)]
cw, ch, cols = 180, 240, 8
for n, start in enumerate(range(0, len(fs), 32)):
    part = list(range(start, min(len(fs), start + 32)))
    c = Image.new("RGB", (cw * cols, ch * ((len(part) + cols - 1) // cols)), (40, 40, 40)); d = ImageDraw.Draw(c)
    for k, i in enumerate(part):
        c.paste(Image.open(fs[i]).crop((0, 170, 360, 650)).resize((cw, ch)), ((k % cols) * cw, (k // cols) * ch)); d.text(((k % cols) * cw + 3, (k // cols) * ch + 2), names[i], fill=(255, 255, 0))
    c.save(f"build/rigcheck/sheet_{n + 1}.png"); print("wrote", f"build/rigcheck/sheet_{n + 1}.png")
print("NOW LOOK at every sheet. Fail if: torso floating above the legs, knees bending backward, stretched/twisted legs, feet stuck on the ground in a jump.")
