# Test fixtures

- `journey-clip.mp4` — the e2e journey upload (8 s, 720x1280, 15 fps, H.264/AAC, 440 Hz tone with silent gaps at 2.5–3.2 s and 5.5–6.2 s, ~370 KB). Regenerate with:
  `ffmpeg -y -f lavfi -i "testsrc2=size=720x1280:rate=15:duration=8" -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=8" -af "volume=enable='between(t,2.5,3.2)+between(t,5.5,6.2)':volume=0" -c:v libx264 -preset slow -crf 44 -pix_fmt yuv420p -g 15 -c:a aac -b:a 48k -ac 1 -movflags +faststart -shortest tests/fixtures/journey-clip.mp4`
- `test-video.mp4` — legacy and corrupt (no moov atom); don't use it for anything that decodes video.
