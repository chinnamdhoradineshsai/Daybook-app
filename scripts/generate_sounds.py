"""
Generates clean, pleasant, lightweight PCM WAV victory sound files
for Daybook task & milestone completion using Python standard library.
"""
import os
import wave
import struct
import math

def generate_tone_sequence(notes, filename, sample_rate=44100):
    """
    notes: list of (freq, start_time, duration, max_volume)
    """
    total_duration = max(start + dur for _, start, dur, _ in notes) + 0.1
    num_samples = int(total_duration * sample_rate)
    samples = [0.0] * num_samples

    for freq, start_time, duration, volume in notes:
        start_idx = int(start_time * sample_rate)
        dur_samples = int(duration * sample_rate)
        for i in range(dur_samples):
            idx = start_idx + i
            if idx >= num_samples:
                break
            t = i / sample_rate
            # Smooth attack and exponential decay
            envelope = math.sin(math.pi * min(1.0, i / (0.015 * sample_rate))) * math.exp(-3.5 * (i / dur_samples))
            # Primary sine + gentle harmonic
            val = (math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(4 * math.pi * freq * t)) * envelope * volume
            samples[idx] += val

    # Normalize samples to avoid clipping
    max_val = max(abs(s) for s in samples) if samples else 1.0
    if max_val > 0.95:
        samples = [s * (0.92 / max_val) for s in samples]

    # Convert to 16-bit PCM
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "sounds")
    os.makedirs(output_dir, exist_ok=True)
    full_path = os.path.join(output_dir, filename)

    with wave.open(full_path, "wb") as wf:
        wf.setnchannels(1)  # Mono
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        packed = bytearray()
        for s in samples:
            val = int(max(-32767, min(32767, s * 32767)))
            packed.extend(struct.pack("<h", val))
        wf.writeframes(packed)
    
    print(f"Generated: {full_path} ({len(packed)} bytes, {total_duration:.2f}s)")
    return full_path

def main():
    # 1. Crystal Chime (Ascending bright celebration chime)
    # E5 (659.25), G#5 (830.61), B5 (987.77), E6 (1318.51)
    chime_notes = [
        (659.25, 0.00, 0.35, 0.7),
        (830.61, 0.08, 0.35, 0.75),
        (987.77, 0.16, 0.40, 0.8),
        (1318.51, 0.24, 0.65, 0.9),
    ]
    generate_tone_sequence(chime_notes, "crystal_chime.wav")

    # 2. Level Up Fanfare (Classic cheerful victory melody)
    # C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    level_notes = [
        (523.25, 0.00, 0.12, 0.65),
        (659.25, 0.10, 0.12, 0.7),
        (783.99, 0.20, 0.14, 0.75),
        (1046.50, 0.32, 0.55, 0.9),
    ]
    generate_tone_sequence(level_notes, "level_up.wav")

    # 3. Zen Bell (Deep, rich peaceful resonance)
    # A4 (440) + warm harmonics
    zen_notes = [
        (587.33, 0.00, 1.10, 0.85), # D5
        (880.00, 0.00, 0.80, 0.45), # A5
        (1174.66, 0.00, 0.50, 0.25), # D6
    ]
    generate_tone_sequence(zen_notes, "zen_bell.wav")

    # 4. Arcade Pop (Fun snappy retro blip)
    arcade_notes = [
        (440.0, 0.00, 0.08, 0.7),
        (554.37, 0.07, 0.08, 0.75),
        (659.25, 0.14, 0.08, 0.8),
        (880.0, 0.21, 0.35, 0.85),
    ]
    generate_tone_sequence(arcade_notes, "arcade_win.wav")

if __name__ == "__main__":
    main()
