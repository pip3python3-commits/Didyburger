#!/usr/bin/env bash
# Same steps as the GitHub workflow, on one machine.  Usage: ./run_local.sh [story.json] [width] [height]
set -euo pipefail
STORY=${1:-story/molasses.json}; W=${2:-720}; H=${3:-1280}; FPS=30
python3 pipeline/tts.py --story "$STORY" --out build --models models
node renderer/render.mjs --timeline build/timeline.json --out build/frames --width "$W" --height "$H" --fps $FPS
ffmpeg -y -framerate $FPS -i build/frames/f_%05d.jpg -i build/audio.wav \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" -c:v libx264 -preset medium -crf 15 \
  -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart out.mp4
