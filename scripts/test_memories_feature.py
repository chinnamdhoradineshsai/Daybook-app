import requests
import json

BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    print("=== Testing Memories / Daily Diary API ===")
    
    # 1. Health check
    res = requests.get(f"{BASE_URL}/api/dashboard")
    assert res.status_code == 200, f"Dashboard failed: {res.status_code}"
    print("[PASS] Dashboard is accessible")

    # 2. Create pure-text entry (no photo, optional title)
    payload_text_only = {
        "title": "A Quiet Evening Reflection",
        "date": "2026-10-14",
        "time": "08:30 PM",
        "location": "Home Library",
        "mood": "😌 Peaceful",
        "journal_text": "Spent the evening listening to soft rain against the windowpane. Writing this diary entry without any photos to reflect calmly on today's achievements.",
        "photos": [],
        "tags": "peaceful, rain, evening"
    }
    res = requests.post(f"{BASE_URL}/api/memories", json=payload_text_only)
    assert res.status_code in (200, 201), f"Create text-only memory failed: {res.text}"
    created_text = res.json()
    text_entry_id = created_text.get("id")
    print(f"[PASS] Created pure text diary entry: ID={text_entry_id}")

    # 3. Create entry with photos and empty title (title should fallback gracefully)
    payload_with_photos = {
        "title": "",  # Empty title -> should default to f"Entry for {date}" or similar
        "date": "2026-10-15",
        "time": "02:15 PM",
        "location": "Botanical Garden",
        "mood": "✨ Inspired",
        "journal_text": "Walked through the glasshouse orchid pavilion. The colors and fragrant air were breathtaking.",
        "photos": ["/static/uploads/memories/araku_valley_scenic.jpg", "/static/uploads/memories/college_event_tech.jpg"],
        "tags": "orchids, nature"
    }
    res = requests.post(f"{BASE_URL}/api/memories", json=payload_with_photos)
    assert res.status_code in (200, 201), f"Create photo memory failed: {res.text}"
    created_photo = res.json()
    photo_entry_id = created_photo.get("id")
    print(f"[PASS] Created memory with photos & empty title: ID={photo_entry_id}, Title='{created_photo.get('title')}'")

    # 4. Search memories with query
    res = requests.get(f"{BASE_URL}/api/memories?q=orchid")
    assert res.status_code == 200, f"Search failed: {res.text}"
    results = res.json()
    assert len(results) >= 1, "Expected search results for 'orchid'"
    assert any("orchid" in (m.get("journal_text") or "").lower() for m in results)
    print(f"[PASS] Search query '?q=orchid' returned {len(results)} matches")

    # 5. Check calendar dots
    res = requests.get(f"{BASE_URL}/api/memories/calendar-dots")
    assert res.status_code == 200, f"Calendar dots failed: {res.text}"
    res_dots = res.json()
    dots = res_dots if isinstance(res_dots, list) else res_dots.get("dots", [])
    assert "2026-10-14" in dots, "2026-10-14 should have a dot"
    assert "2026-10-15" in dots, "2026-10-15 should have a dot"
    print(f"[PASS] Calendar dots verified: {len(dots)} dates with memories")

    # 6. Update memory (edit text & mood)
    updated_payload = {
        "title": "A Quiet Evening Reflection (Updated)",
        "date": "2026-10-14",
        "time": "09:00 PM",
        "location": "Home Library",
        "mood": "🌟 Grateful",
        "journal_text": "Spent the evening listening to soft rain. Read two chapters of a great novel and drank chamomile tea.",
        "photos": [],
        "tags": "peaceful, chamomile, reading"
    }
    res = requests.put(f"{BASE_URL}/api/memories/{text_entry_id}", json=updated_payload)
    assert res.status_code == 200, f"Update memory failed: {res.text}"
    updated = res.json()
    assert updated.get("mood") == "🌟 Grateful"
    print(f"[PASS] Memory updated successfully")

    # 7. Check one-entry-per-day filter query: GET /api/memories?date=2026-10-14
    res = requests.get(f"{BASE_URL}/api/memories?date=2026-10-14")
    assert res.status_code == 200
    entries_for_day = res.json()
    assert len(entries_for_day) >= 1
    print(f"[PASS] Date filter query /api/memories?date=2026-10-14 returned entry: {entries_for_day[0]['title']}")

    # 8. Clean up created test entries
    res = requests.delete(f"{BASE_URL}/api/memories/{text_entry_id}")
    assert res.status_code == 200
    res = requests.delete(f"{BASE_URL}/api/memories/{photo_entry_id}")
    assert res.status_code == 200
    print("[PASS] Test cleanup completed")

    print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY! [OK]")

if __name__ == "__main__":
    run_tests()
