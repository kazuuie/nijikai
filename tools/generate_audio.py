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
    suspense = []
    notes = [523.25, 659.25, 783.99, 1046.5]
    for i in range(RATE * 2):
        t = i / RATE
        step = int(t * 8)
        local = t % .125
        envelope = min(1, local / .004) * math.exp(-local * 30)
        frequency = notes[step % 4]
        suspense.append(envelope * (math.sin(math.tau * frequency * local)
                                    + .15 * math.sin(math.tau * frequency * 2 * local)))
    write("suspense.wav", suspense, .60)
    celebration = []
    for i in range(round(RATE * 2.4)):
        t = i / RATE
        value = 0
        for start, frequencies in [(0, [523.25, 659.25]), (.16, [659.25, 783.99]),
                                   (.32, [783.99, 1046.5]), (.50, [523.25, 659.25, 783.99, 1046.5])]:
            age = t-start
            if age >= 0:
                envelope = min(1, age/.008) * math.exp(-age*2.8)
                value += envelope * sum(math.sin(math.tau*f*age)+.18*math.sin(math.tau*f*2*age) for f in frequencies)
        celebration.append(value * min(1, (2.4-t)/.1))
    write("celebration.wav", celebration, .75)
    surge = []
    phase = 0
    for i in range(round(RATE * .95)):
        t = i / RATE
        frequency = 160 + 1650 * (t/.95)**1.5
        phase += math.tau * frequency / RATE
        envelope = min(1, t/.025) * min(1, (.95-t)/.17)
        carrier = math.sin(phase + 1.8*math.sin(phase*.5))
        harmonics = .24*math.sin(phase*2.01) + .12*math.sin(phase*3)
        surge.append(envelope * math.tanh(1.6*(carrier+harmonics)) * (.85+.15*math.sin(math.tau*23*t)))
    write("surge.wav", surge, .70)
    grand = []
    for i in range(round(RATE * 3.8)):
        t = i / RATE
        value = 0
        for start, root in [(0, 130.81), (.18, 164.81), (.36, 196.0), (.72, 130.81)]:
            age = t-start
            if age >= 0:
                envelope = min(1, age/.005)*math.exp(-age*(2.7 if start<.72 else 1.5))
                chord = sum(math.sin(math.tau*root*ratio*age)+.3*math.sin(math.tau*root*ratio*2*age)
                            for ratio in [1, 1.25, 1.5, 2, 4])
                drum = 2*math.exp(-age*18)*math.sin(math.tau*(65*age+1.8*(1-math.exp(-age*30))))
                value += envelope*chord+drum
        grand.append(math.tanh(value*.35)*min(1,(3.8-t)/.2))
    write("grand.wav", grand, .88)


if __name__ == "__main__":
    main()
