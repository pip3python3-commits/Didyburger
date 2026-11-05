# Didyburger: story-video builder

Procedural 3D "story explainer" videos (detailed toy-like sets, cartoon characters that talk and act, Kokoro TTS narration,
word-by-word captions), rendered entirely in GitHub Actions. Pushing `story/story.json` starts a render; the finished video
is published as a GitHub Release.

Current short: **The Great Hanoi Rat Bounty** (`story/story.json`).

```
story/story.json            narration + storyboard (cast with skin tones, beats, shots, actors, fx)
story/examples/             finished examples (Hanoi rat bounty, Boston molasses flood, long-form skeletons)
pipeline/tts.py             Kokoro-ONNX TTS -> faster-whisper word timings -> lip-sync envelope -> SFX -> timeline + audio
renderer/src/rig.js         characters: skin tones, layered faces, lip-sync visemes, blinks, eye-lines, gestures, props
renderer/src/look.js        post: depth of field, bloom, light shafts, painterly filter, ghost/iris/zoom cuts, rage veins, cracks
renderer/src/fx.js          particles: dust, rain, confetti, coins, paper, sparks, smoke, debris
renderer/src/sets/          worlds: oldquarter, sewer, office, ratfarm (+ dress.js prop kit, rats.js swarm), studio, lab
.github/workflows/builder.yml   audio -> render (sharded matrix) -> mux -> GitHub Release -> status on the ci-status branch
```
