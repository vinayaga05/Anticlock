#!/usr/bin/env python3
"""Generate the DEV SAMPLE music track used by development builds.

Writes apps/mobile/dev-assets/music/dev-sample-tone.m4a: 30 s of synthetic
audio (a simple chord pad plus a kick-like pulse at 120 BPM). Only the
standard library is used to synthesise it. macOS `afconvert` (or ffmpeg)
encodes it to AAC.

This is a generated test signal, not music from any third party, and it is
never bundled into release builds (see src/features/reels/music/README.md).
"""
import math
import os
import shutil
import struct
import subprocess
import tempfile
import wave

RATE = 44100
SECONDS = 30
BPM = 120
OUT = os.path.join(os.path.dirname(__file__), "..", "dev-assets", "music", "dev-sample-tone.m4a")


def sample(t: float) -> float:
    beat = 60.0 / BPM
    bar = int(t / (beat * 4)) % 4
    roots = [220.0, 174.61, 196.0, 164.81]  # A3, F3, G3, E3
    root = roots[bar]
    pad = sum(math.sin(2 * math.pi * root * ratio * t) for ratio in (1.0, 1.25, 1.5)) / 3.0
    phase = t % beat
    kick = math.sin(2 * math.pi * (60 + 90 * math.exp(-phase * 30)) * phase) * math.exp(-phase * 9)
    fade = min(1.0, t / 0.5, (SECONDS - t) / 0.5)
    return (0.35 * pad + 0.55 * kick) * fade


def main() -> None:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, "tone.wav")
        with wave.open(wav_path, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            frames = bytearray()
            for i in range(RATE * SECONDS):
                value = max(-1.0, min(1.0, sample(i / RATE)))
                frames += struct.pack("<h", int(value * 32000))
            wav.writeframes(bytes(frames))
        if shutil.which("afconvert"):
            subprocess.check_call(["afconvert", "-f", "m4af", "-d", "aac", "-b", "96000", wav_path, OUT])
        elif shutil.which("ffmpeg"):
            subprocess.check_call(["ffmpeg", "-y", "-i", wav_path, "-c:a", "aac", "-b:a", "96k", OUT])
        else:
            raise SystemExit("Need macOS afconvert or ffmpeg to encode AAC")
    print(f"Wrote {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
