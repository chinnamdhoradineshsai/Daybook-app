import requests
import base64
import os

BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    print("[1] Testing GET /api/preferences...")
    r = requests.get(f"{BASE_URL}/api/preferences")
    assert r.status_code == 200, f"Failed GET /api/preferences: {r.status_code}"
    prefs = r.json()
    print("  Preferences received:", prefs)
    assert "custom_bg_enabled" in prefs
    assert "custom_bg_fit" in prefs
    assert "custom_bg_position" in prefs
    assert "custom_bg_overlay_mode" in prefs
    assert "custom_bg_blur" in prefs

    print("\n[2] Testing POST /api/preferences (background preferences update)...")
    payload = {
        "custom_bg_enabled": 1,
        "custom_bg_fit": "cover",
        "custom_bg_position": "center",
        "custom_bg_overlay_mode": "dark",
        "custom_bg_overlay_opacity": 0.50,
        "custom_bg_blur": 5,
        "custom_bg_dynamic_accent": 1,
        "custom_bg_accent_color": "#10b981"
    }
    r = requests.post(f"{BASE_URL}/api/preferences", json=payload)
    assert r.status_code == 200, f"Failed POST /api/preferences: {r.status_code}"
    resp_data = r.json()
    updated = resp_data.get("preferences", resp_data)
    assert updated.get("custom_bg_enabled") == 1
    assert updated.get("custom_bg_accent_color") == "#10b981"
    print("  Successfully updated preferences:", updated.get("custom_bg_accent_color"))

    print("\n[3] Testing POST /api/background/upload (JSON base64)...")
    sample_file = "d:/Task/static/uploads/sample_wallpaper.jpg"
    with open(sample_file, "rb") as f:
        data = f.read()
    b64 = "data:image/jpeg;base64," + base64.b64encode(data).decode('utf-8')

    upload_payload = {
        "image_data": b64,
        "fit": "cover",
        "position": "center",
        "overlay_mode": "dark",
        "overlay_opacity": 0.40,
        "blur": 2,
        "dynamic_accent": 1,
        "accent_color": "#8b5cf6"
    }
    r = requests.post(f"{BASE_URL}/api/background/upload", json=upload_payload)
    assert r.status_code == 200, f"Failed upload: {r.status_code} {r.text}"
    resp = r.json()
    print("  Upload response:", resp)
    assert resp.get("success") is True
    assert "image_url" in resp
    image_url = resp["image_url"]
    print("  Stored image url:", image_url)

    print("\n[4] Testing GET uploaded image static file...")
    img_resp = requests.get(f"{BASE_URL}{image_url}")
    assert img_resp.status_code == 200
    print("  Static image reachable, bytes length:", len(img_resp.content))

    print("\n[5] Testing DELETE /api/background/photo (restore default)...")
    del_resp = requests.delete(f"{BASE_URL}/api/background/photo")
    assert del_resp.status_code == 200
    print("  Delete response:", del_resp.json())

    r = requests.get(f"{BASE_URL}/api/preferences")
    reverted_prefs = r.json()
    assert reverted_prefs.get("custom_bg_enabled") == 0
    assert reverted_prefs.get("custom_bg_image_url") is None
    print("  Custom background disabled and photo cleared successfully!")

    print("\n>>> ALL BACKEND API TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    run_tests()
