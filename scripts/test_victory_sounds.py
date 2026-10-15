import io
import os
import sys
import wave

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import app

def run_tests():
    client = app.app.test_client()

    print("=== 1. Testing GET /api/sounds ===")
    res = client.get("/api/sounds")
    assert res.status_code == 200, f"Status {res.status_code}"
    sounds = res.get_json()
    print(f"Retrieved {len(sounds)} sounds:")
    for s in sounds:
        print(f"  - {s['id']}: {s['title']} ({s['file_format']})")

    print("\n=== 2. Testing GET & POST /api/preferences ===")
    res = client.get("/api/preferences")
    assert res.status_code == 200
    prefs = res.get_json()
    print("Initial prefs:", {k: prefs.get(k) for k in ["victory_sound_enabled", "victory_sound_volume", "active_task_sound_id", "sound_event_mode"]})

    res = client.post("/api/preferences", json={
        "victory_sound_enabled": 1,
        "victory_sound_volume": 0.85,
        "active_task_sound_id": "default_victory",
        "sound_event_mode": "every_task"
    })
    assert res.status_code == 200
    print("Preferences updated successfully.")

    print("\n=== 3. Testing Audio Validation in app.py ===")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(22050)
        wav.writeframes(b"\x00\x00" * 22050)
    wav_bytes = buf.getvalue()
    valid, fmt, dur, err = app.validate_audio_binary(wav_bytes, "test.wav")
    assert valid, f"Validation error: {err}"
    print(f"Valid WAV verified! Format: {fmt}, Duration: {dur:.1f}s")

    # Test oversized
    oversized = b"0" * (5 * 1024 * 1024 + 10)
    valid, fmt, dur, err = app.validate_audio_binary(oversized, "huge.wav")
    assert not valid and "File exceeds" in err
    print("Oversized rejection verified.")

    # Test invalid fake audio
    valid, fmt, dur, err = app.validate_audio_binary(b"Not an audio file at all!", "fake.wav")
    assert not valid
    print("Corrupt/fake audio rejection verified.")

    print("\n=== 4. Testing Sound Upload & Replace API ===")
    upload_data = {
        "audio": (io.BytesIO(wav_bytes), "test_fanfare.wav"),
        "title": "Test Fanfare",
        "event_trigger": "task_complete",
        "is_default": "true"
    }
    res = client.post("/api/sounds", data=upload_data, content_type="multipart/form-data")
    assert res.status_code in (200, 201), f"Upload status {res.status_code}: {res.data}"
    uploaded_sound = res.get_json()
    print(f"Uploaded custom sound ID: {uploaded_sound['id']}, title: {uploaded_sound['title']}")

    # Test Replace
    replace_data = {
        "audio": (io.BytesIO(wav_bytes), "replaced_fanfare.wav"),
        "title": "Replaced Fanfare"
    }
    res = client.post(f"/api/sounds/{uploaded_sound['id']}/replace", data=replace_data, content_type="multipart/form-data")
    assert res.status_code == 200, f"Replace failed: {res.data}"
    replaced = res.get_json()
    print(f"Replaced sound title: {replaced['title']}")

    # Test Delete
    res = client.delete(f"/api/sounds/{uploaded_sound['id']}")
    assert res.status_code == 200, f"Delete failed: {res.data}"
    print("Custom sound deleted successfully.")

    # Protect starter sounds from deletion
    res = client.delete("/api/sounds/default_victory")
    assert res.status_code in (400, 403), f"Expected 400/403, got {res.status_code}"
    print("Starter sound protected from deletion.")

    print("\n=== 5. Testing Dashboard and Tasks API ===")
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    dash = res.get_json()
    print("Dashboard metrics:", {k: dash.get(k) for k in ["focus_score", "total_tasks", "completed_tasks", "active_projects"]})

    print("\nALL SERVER TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
