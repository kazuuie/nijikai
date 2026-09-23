"""Generate original, deterministic roulette Foley WAVs; no dependencies."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
ROOT = Path(__file__).resolve().parents[1] / "public" / "audio"


def write(name, samples, peak):
    scale = peak * 32767 / max(abs(value) for value in samples)
    with wave.open(str(ROOT / name), "wb") as output:
        output.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        output.writeframes(b"".join(struct.pack("<h", round(value * scale)) for value in samples))


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    rng = random.Random(20260921)
    # Integer-frequency partials and circularly filtered noise make seamless loops.
    count = RATE * 2
    noise = [rng.uniform(-1, 1) for _ in range(count)]
    low = [sum(noise[(i-j) % count] for j in range(12)) / 12 for i in range(count)]
    wheel, ball = [], []
    for i in range(count):
        t = i / RATE
        wheel.append(.35 * low[i] + .11 * math.sin(math.tau * 82 * t)
                     + .055 * math.sin(math.tau * 164 * t)
                     + .035 * math.sin(math.tau * 247 * t))
        pulse = math.exp(-((t * 24) % 1) * 19)
        ball.append(.22 * (noise[i] - low[i]) * (.3 + .7 * pulse)
                    + pulse * (.14 * math.sin(math.tau * 1452 * t)
                               + .07 * math.sin(math.tau * 2232 * t)))
    write("wheel.wav", wheel, .65)
    write("ball.wav", ball, .72)
    # Preserve the existing collision noise sequence when regenerating assets.
    for _ in range(round(RATE * .23)):
        rng.uniform(-1, 1)
    collision = []
    for i in range(round(RATE * .075)):
        t = i / RATE
        envelope = min(1, t / .0015) * math.exp(-t * 85) * min(1, (.075-t) / .012)
        collision.append(envelope * (.60 * math.sin(math.tau * 1080 * t)
                                    + .18 * math.sin(math.tau * 1715 * t)
                                    + .08 * rng.uniform(-1, 1)))
    write("collision.wav", collision, .65)


if __name__ == "__main__":
    main()
