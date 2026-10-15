"""
Daybook - Mobile-First Productivity & Notes App
Flask REST API Backend (Two-Level Tasks, Projects & Product Enhancements)
"""

import os
import sys
import base64
import re
import uuid
import hashlib
import wave
import io
from datetime import datetime, timezone
from flask import Flask, render_template, jsonify, request, Response, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

import database

try:
    from PIL import Image as PILImage
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

# Load environment configuration from .env file if available
load_dotenv()

# Audio Validation Limits
MAX_AUDIO_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_AUDIO_DURATION = 15.5          # 15.5 seconds max

def validate_audio_binary(audio_bytes, original_filename=""):
    """
    Validates uploaded audio against format, actual content headers, size, and duration.
    Never relies solely on client-side validation.
    """
    if not audio_bytes or len(audio_bytes) == 0:
        return False, None, 0.0, "Empty audio file received."

    if len(audio_bytes) > MAX_AUDIO_SIZE:
        size_mb = len(audio_bytes) / (1024 * 1024)
        return False, None, 0.0, f"File exceeds maximum size limit of 5 MB (received {size_mb:.2f} MB)."

    ALLOWED_EXTS = {"mp3", "wav", "ogg", "m4a", "webm"}
    clean_name = (original_filename or "").strip().lower()
    ext = clean_name.rsplit(".", 1)[-1] if "." in clean_name else "mp3"
    if ext not in ALLOWED_EXTS:
        return False, None, 0.0, f"Unsupported audio extension '.{ext}'. Supported formats: MP3, WAV, OGG, M4A, WEBM."

    # Content verification using audio container magic numbers
    is_authentic_audio = False
    duration_detected = 0.0

    if len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        is_authentic_audio = True
        ext = "wav"
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                if rate > 0:
                    duration_detected = frames / float(rate)
        except Exception:
            pass
    elif audio_bytes[:3] == b"ID3" or (len(audio_bytes) > 2 and audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0):
        is_authentic_audio = True
        ext = "mp3"
    elif audio_bytes[:4] == b"OggS":
        is_authentic_audio = True
        ext = "ogg"
    elif len(audio_bytes) >= 8 and audio_bytes[4:8] == b"ftyp":
        is_authentic_audio = True
        ext = "m4a"
    elif audio_bytes[:4] == b"\x1a\x45\xdf\xa3":
        is_authentic_audio = True
        ext = "webm"
    elif ext == "mp3" and any(audio_bytes[i:i+2] == b"\xff\xfb" or audio_bytes[i:i+2] == b"\xff\xf3" for i in range(min(512, len(audio_bytes)-1))):
        is_authentic_audio = True
        ext = "mp3"

    if not is_authentic_audio:
        return False, None, 0.0, "File content is not a recognized, valid audio format."

    if duration_detected > MAX_AUDIO_DURATION:
        return False, ext, duration_detected, f"Sound duration ({duration_detected:.1f}s) exceeds the 15-second celebratory audio limit."

    return True, ext, duration_detected, None



def _supabase_storage_config():
    """Returns (url, key) for server-side Supabase Storage access."""
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = (
        os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or ""
    )
    return url, key


def _supabase_request_headers(content_type=None):
    """Build headers that work with both new sb_secret_* keys and legacy JWT service-role keys."""
    _, key = _supabase_storage_config()
    headers = {"apikey": key}

    # New Supabase publishable/secret keys are API keys, not JWTs.
    # Sending them as "Authorization: Bearer ..." can cause "Invalid JWT".
    # Legacy service_role keys are JWTs and still use the Bearer header.
    if key and not key.startswith(("sb_secret_", "sb_publishable_")):
        headers["Authorization"] = f"Bearer {key}"

    if content_type:
        headers["Content-Type"] = content_type

    return headers


def upload_bytes_to_supabase(bucket, object_path, payload, content_type="application/octet-stream"):
    """Uploads bytes to a public Supabase Storage bucket and returns a browser-ready URL."""
    supabase_url, supabase_key = _supabase_storage_config()
    if not supabase_url or not supabase_key:
        return None

    import requests
    from urllib.parse import quote

    encoded_path = quote(object_path, safe="/")
    endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{encoded_path}"
    headers = _supabase_request_headers(content_type)
    headers["x-upsert"] = "true"
    response = requests.post(endpoint, data=payload, headers=headers, timeout=30)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Supabase Storage upload failed ({response.status_code}): {response.text[:300]}")
    # Keep buckets private. Browser assets are served through our authenticated Flask proxy.
    return f"/api/storage/{bucket}/{encoded_path}"


def delete_supabase_public_url(public_url):
    """Best-effort deletion for URLs returned by upload_bytes_to_supabase."""
    if not public_url:
        return False
    supabase_url, supabase_key = _supabase_storage_config()
    if not supabase_url or not supabase_key:
        return False
    try:
        import requests
        if public_url.startswith("/api/storage/"):
            suffix = public_url.replace("/api/storage/", "", 1)
        elif "/storage/v1/object/public/" in public_url:
            suffix = public_url.split("/storage/v1/object/public/", 1)[1]
        else:
            return False
        bucket, object_path = suffix.split("/", 1)
        endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"
        response = requests.delete(
            endpoint,
            headers=_supabase_request_headers(),
            timeout=10,
        )
        return response.status_code in (200, 204)
    except Exception:
        return False


def optimize_image_bytes(raw_bytes, max_dim=1800, quality=84):
    """Compresses an uploaded image server-side so the browser never has to decode huge photos."""
    if not raw_bytes:
        raise ValueError("Empty image")
    if not PILLOW_AVAILABLE:
        return raw_bytes, "application/octet-stream", None

    image = PILImage.open(io.BytesIO(raw_bytes))
    image.load()
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    elif image.mode == "L":
        image = image.convert("RGB")
    if image.width > max_dim or image.height > max_dim:
        image.thumbnail((max_dim, max_dim), PILImage.LANCZOS)
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=quality, optimize=True)
    return out.getvalue(), "image/jpeg", ".jpg"

def create_app():
    """Application factory to configure and return the Flask application."""
    app = Flask(__name__)

    # Core configuration
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "daybook-insecure-dev-key")
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25MB max request

    # Configure CORS for Vercel and local web clients
    allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
    if not allowed_origins or allowed_origins == ["*"]:
        CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)
    else:
        CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    # Initialize database tables and migrations
    with app.app_context():
        database.init_db()

    # -------------------------------------------------------------
    # Frontend & PWA Routes
    # -------------------------------------------------------------
    @app.route("/")
    def index():
        """Renders the mobile-first Daybook workspace."""
        return render_template("index.html")

    @app.route("/sw.js")
    def service_worker():
        """Serves the PWA Service Worker with proper Service-Worker-Allowed header."""
        response = send_from_directory(app.static_folder, "sw.js", mimetype="application/javascript")
        response.headers["Service-Worker-Allowed"] = "/"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response

    @app.route("/manifest.json")
    def manifest():
        """Serves the Web App Manifest."""
        response = send_from_directory(app.static_folder, "manifest.json", mimetype="application/manifest+json")
        response.headers["Cache-Control"] = "no-cache"
        return response

    @app.route("/api/storage/<bucket>/<path:object_path>", methods=["GET"])
    def proxy_storage_object(bucket, object_path):
        """Streams a private Supabase Storage object through the Flask backend."""
        allowed_buckets = {"daybook-memories", "daybook-backgrounds", "daybook-sounds"}
        if bucket not in allowed_buckets:
            return jsonify({"error": "Unknown storage bucket"}), 404
        supabase_url, supabase_key = _supabase_storage_config()
        if not supabase_url or not supabase_key:
            return jsonify({"error": "Storage is not configured"}), 503
        try:
            import requests
            from urllib.parse import quote
            encoded_path = quote(object_path, safe="/")
            endpoint = f"{supabase_url}/storage/v1/object/{bucket}/{encoded_path}"
            upstream = requests.get(
                endpoint,
                headers=_supabase_request_headers(),
                timeout=20,
            )
            if upstream.status_code != 200:
                return jsonify({"error": "Stored file not found"}), upstream.status_code
            response = Response(upstream.content, status=200, mimetype=upstream.headers.get("Content-Type", "application/octet-stream"))
            response.headers["Cache-Control"] = "public, max-age=86400"
            return response
        except Exception as exc:
            app.logger.exception("Storage proxy failed")
            return jsonify({"error": f"Storage read failed: {exc}"}), 500

    # -------------------------------------------------------------
    # System & Health API
    # -------------------------------------------------------------
    @app.route("/api/health", methods=["GET"])
    def health_check():
        now = datetime.now(timezone.utc)
        return jsonify({
            "status": "healthy",
            "app": "Daybook",
            "version": "1.3.0",
            "server_time": now.isoformat(),
            "environment": os.getenv("FLASK_ENV", "development"),
            "database_type": "PostgreSQL (Supabase)" if database.IS_POSTGRES else "SQLite (Local Dev)",
            "database_configured": bool(os.getenv("DATABASE_URL") or os.getenv("SUPABASE_URL")),
        }), 200

    # -------------------------------------------------------------
    # Dashboard API (Section 23 - D)
    # -------------------------------------------------------------
    @app.route("/api/dashboard", methods=["GET"])
    def get_dashboard():
        date_param = request.args.get("date")
        data = database.get_dashboard_data(today_date=date_param)
        return jsonify(data), 200

    @app.route("/api/analytics", methods=["GET"])
    def get_analytics():
        date_param = request.args.get("date")
        data = database.get_analytics_data(reference_date=date_param)
        return jsonify(data), 200

    # -------------------------------------------------------------
    # Today Tasks API (Section 23 - A)
    # -------------------------------------------------------------
    @app.route("/api/tasks", methods=["GET"])
    def list_tasks():
        filter_status = request.args.get("filter", "all")
        task_date = request.args.get("date")
        tasks = database.get_tasks(filter_status=filter_status, task_date=task_date)
        return jsonify(tasks), 200

    @app.route("/api/tasks", methods=["POST"])
    def create_task():
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Task title is required"}), 400

        description = payload.get("description", "")
        priority = payload.get("priority", "normal")
        task_date = payload.get("task_date") or datetime.now().strftime("%Y-%m-%d")
        due_time = payload.get("due_time", None)
        project_id = payload.get("project_id", None)
        recurring = payload.get("recurring", None)

        task = database.create_task(
            title=title,
            description=description,
            priority=priority,
            task_date=task_date,
            due_time=due_time,
            project_id=project_id,
            recurring=recurring,
            reminder=payload.get("reminder"),
        )
        return jsonify(task), 201

    @app.route("/api/tasks/<task_id>", methods=["PUT"])
    def update_task(task_id):
        payload = request.get_json(silent=True) or {}
        scope = request.args.get("scope", "this")  # 'this', 'future', 'all'
        updated = database.update_task_with_scope(task_id, payload, scope=scope)
        if not updated:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(updated), 200

    @app.route("/api/tasks/<task_id>/toggle", methods=["PATCH"])
    def toggle_task(task_id):
        payload = request.get_json(silent=True) or {}
        is_completed = payload.get("is_completed", True)
        result = database.toggle_task(task_id, is_completed)
        return jsonify(result), 200

    @app.route("/api/tasks/<task_id>/reschedule", methods=["PATCH"])
    def reschedule_task(task_id):
        payload = request.get_json(silent=True) or {}
        new_date = payload.get("new_date")
        if not new_date:
            return jsonify({"error": "new_date is required"}), 400

        updated = database.reschedule_task(task_id, new_date)
        if not updated:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(updated), 200

    @app.route("/api/tasks/<task_id>", methods=["DELETE"])
    def delete_task(task_id):
        scope = request.args.get("scope", "this")  # 'this', 'future', 'all'
        success = database.delete_task(task_id, scope=scope)
        return jsonify({"success": success, "deleted_id": task_id, "scope": scope}), 200

    # -------------------------------------------------------------
    # Subtasks & Checklists API (Feature Two: Subtasks and Checklists)
    # -------------------------------------------------------------
    @app.route("/api/tasks/<task_id>/subtasks", methods=["GET"])
    def list_subtasks(task_id):
        subtasks = database.get_subtasks(task_id)
        return jsonify(subtasks), 200

    @app.route("/api/tasks/<task_id>/subtasks", methods=["POST"])
    def create_subtask(task_id):
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Subtask title is required"}), 400
        subtask = database.create_subtask(task_id, title)
        return jsonify(subtask), 201

    @app.route("/api/subtasks/<subtask_id>", methods=["PUT"])
    def update_subtask(subtask_id):
        payload = request.get_json(silent=True) or {}
        updated = database.update_subtask(subtask_id, payload)
        if not updated:
            return jsonify({"error": "Subtask not found"}), 404
        return jsonify(updated), 200

    @app.route("/api/subtasks/<subtask_id>/toggle", methods=["PATCH"])
    def toggle_subtask(subtask_id):
        payload = request.get_json(silent=True) or {}
        is_completed = payload.get("is_completed", True)
        result = database.toggle_subtask(subtask_id, is_completed)
        if not result:
            return jsonify({"error": "Subtask not found"}), 404
        return jsonify(result), 200

    @app.route("/api/subtasks/<subtask_id>", methods=["DELETE"])
    def delete_subtask(subtask_id):
        success = database.delete_subtask(subtask_id)
        return jsonify({"success": success, "deleted_id": subtask_id}), 200

    @app.route("/api/tasks/<task_id>/subtasks/reorder", methods=["POST"])
    def reorder_subtasks(task_id):
        payload = request.get_json(silent=True) or {}
        subtask_ids = payload.get("subtask_ids", [])
        updated = database.reorder_subtasks(task_id, subtask_ids)
        return jsonify(updated), 200

    # -------------------------------------------------------------
    # Recurring Rules API (Feature One: Recurring Tasks)
    # -------------------------------------------------------------
    @app.route("/api/recurring-rules", methods=["GET"])
    def list_recurring_rules():
        rules = database.get_recurring_rules()
        return jsonify(rules), 200

    @app.route("/api/recurring-rules", methods=["POST"])
    def create_recurring_rule():
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Title is required"}), 400

        rule = database.create_recurring_rule(
            title=title,
            description=payload.get("description", ""),
            priority=payload.get("priority", "normal"),
            frequency=payload.get("frequency", "daily"),
            interval_val=payload.get("interval_val", 1),
            by_weekdays=payload.get("by_weekdays", []),
            start_date=payload.get("start_date"),
            end_date=payload.get("end_date"),
            due_time=payload.get("due_time"),
            project_id=payload.get("project_id"),
        )
        return jsonify(rule), 201

    @app.route("/api/recurring-rules/<rule_id>", methods=["GET"])
    def get_recurring_rule(rule_id):
        rule = database.get_recurring_rule_by_id(rule_id)
        if not rule:
            return jsonify({"error": "Recurring rule not found"}), 404
        return jsonify(rule), 200

    # -------------------------------------------------------------
    # Monthly Tasks & Projects API (Section 23 - B & C)
    # -------------------------------------------------------------
    @app.route("/api/projects", methods=["GET"])
    def list_projects():
        status_filter = request.args.get("status")
        month = request.args.get("month")
        projects = database.get_projects(status_filter=status_filter, month=month)
        return jsonify(projects), 200

    @app.route("/api/projects", methods=["POST"])
    def create_project():
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Project title is required"}), 400

        description = payload.get("description", "")
        status = payload.get("status", "in_progress")
        start_date = payload.get("start_date")
        deadline = payload.get("deadline")
        color = payload.get("color", "#4f46e5")
        progress = payload.get("progress", 0)
        notes = payload.get("notes", "")
        attachments = payload.get("attachments", [])

        project = database.create_project(
            title=title,
            description=description,
            status=status,
            start_date=start_date,
            deadline=deadline,
            color=color,
            progress=progress,
            notes=notes,
            attachments=attachments,
        )
        return jsonify(project), 201

    @app.route("/api/projects/<project_id>", methods=["GET"])
    def get_project(project_id):
        project = database.get_project_by_id(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(project), 200

    @app.route("/api/projects/<project_id>", methods=["PUT"])
    def update_project(project_id):
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Project title is required"}), 400

        description = payload.get("description", "")
        status = payload.get("status", "in_progress")
        start_date = payload.get("start_date")
        deadline = payload.get("deadline")
        color = payload.get("color", "#4f46e5")
        progress = payload.get("progress")
        notes = payload.get("notes")
        attachments = payload.get("attachments")

        project = database.update_project(
            project_id=project_id,
            title=title,
            description=description,
            status=status,
            start_date=start_date,
            deadline=deadline,
            color=color,
            progress=progress,
            notes=notes,
            attachments=attachments,
        )
        if not project:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(project), 200

    @app.route("/api/projects/<project_id>", methods=["DELETE"])
    def delete_project(project_id):
        database.delete_project(project_id)
        return jsonify({"success": True, "deleted_id": project_id}), 200

    @app.route("/api/projects/<project_id>/milestones", methods=["POST"])
    def create_project_milestone(project_id):
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Milestone title is required"}), 400

        deadline = payload.get("deadline")
        priority = payload.get("priority", "normal")

        milestone = database.create_milestone(
            project_id=project_id,
            title=title,
            deadline=deadline,
            priority=priority,
        )
        return jsonify(milestone), 201

    @app.route("/api/milestones/<milestone_id>/toggle", methods=["PATCH"])
    def toggle_project_milestone(milestone_id):
        payload = request.get_json(silent=True) or {}
        is_completed = payload.get("is_completed", True)
        updated = database.toggle_milestone(milestone_id, is_completed)
        return jsonify(updated), 200

    @app.route("/api/milestones/<milestone_id>", methods=["DELETE"])
    def delete_project_milestone(milestone_id):
        database.delete_milestone(milestone_id)
        return jsonify({"success": True, "deleted_id": milestone_id}), 200

    # -------------------------------------------------------------
    # Notes API (Section 22 - 1 & 2)
    # -------------------------------------------------------------
    @app.route("/api/notes", methods=["GET"])
    def list_notes():
        search_query = request.args.get("q", "").strip()
        sort_by = request.args.get("sort", "updated")
        notes = database.get_notes(search_query=search_query, sort=sort_by)
        return jsonify(notes), 200

    @app.route("/api/notes", methods=["POST"])
    def create_note():
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Note title is required"}), 400

        content = payload.get("content", "")
        tags = payload.get("tags", "")
        is_pinned = payload.get("is_pinned", 0)
        template_type = payload.get("template_type", "blank")

        note = database.create_note(title, content, tags, is_pinned, template_type)
        return jsonify(note), 201

    @app.route("/api/notes/<note_id>", methods=["GET"])
    def get_note(note_id):
        note = database.get_note_by_id(note_id)
        if not note:
            return jsonify({"error": "Note not found"}), 404
        return jsonify(note), 200

    @app.route("/api/notes/<note_id>", methods=["PUT"])
    def update_note(note_id):
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        if not title:
            return jsonify({"error": "Note title is required"}), 400

        content = payload.get("content", "")
        tags = payload.get("tags", "")
        is_pinned = payload.get("is_pinned", 0)
        template_type = payload.get("template_type", "blank")

        note = database.update_note(note_id, title, content, tags, is_pinned, template_type)
        if not note:
            return jsonify({"error": "Note not found"}), 404
        return jsonify(note), 200

    @app.route("/api/notes/<note_id>", methods=["DELETE"])
    def delete_note(note_id):
        database.delete_note(note_id)
        return jsonify({"success": True, "deleted_id": note_id}), 200

    # -------------------------------------------------------------
    # Journals API
    # -------------------------------------------------------------
    @app.route("/api/journals", methods=["GET"])
    def list_journals():
        entries = database.get_journals()
        return jsonify(entries), 200

    @app.route("/api/journals", methods=["POST"])
    def create_journal():
        payload = request.get_json(silent=True) or {}
        content = payload.get("content", "").strip()
        if not content:
            return jsonify({"error": "Journal content cannot be empty"}), 400

        entry_date = payload.get("entry_date") or datetime.now().strftime("%Y-%m-%d")
        mood = payload.get("mood", "good")
        tags = payload.get("tags", "")

        journal = database.create_journal(entry_date, content, mood, tags)
        return jsonify(journal), 201

    @app.route("/api/journals/<journal_id>", methods=["DELETE"])
    def delete_journal(journal_id):
        database.delete_journal(journal_id)
        return jsonify({"success": True, "deleted_id": journal_id}), 200

    # -------------------------------------------------------------
    # Memories API (Personal Digital Diary & Memories Album)
    # -------------------------------------------------------------
    @app.route("/api/memories", methods=["GET"])
    def list_memories():
        date_param = request.args.get("date")
        month_param = request.args.get("month")
        query_param = request.args.get("q") or request.args.get("query")
        limit = int(request.args.get("limit", 100))
        memories = database.get_memories(date=date_param, month=month_param, query=query_param, limit=limit)
        return jsonify(memories), 200

    @app.route("/api/memories/<memory_id>", methods=["GET"])
    def get_memory(memory_id):
        mem = database.get_memory_by_id(memory_id)
        if not mem:
            return jsonify({"error": "Memory not found"}), 404
        return jsonify(mem), 200

    @app.route("/api/memories", methods=["POST"])
    def create_memory():
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        journal_text = payload.get("journal_text") or payload.get("description") or payload.get("content") or ""
        photos = payload.get("photos", [])

        # Validate that user provided at least writing, a title, or photos
        if not title and not journal_text.strip() and not photos:
            return jsonify({"error": "Please write something or attach photos for your diary entry"}), 400

        date_val = payload.get("date") or datetime.now().strftime("%Y-%m-%d")
        time_val = payload.get("time") or datetime.now().strftime("%I:%M %p")
        location = payload.get("location", "")
        mood = payload.get("mood", "😊 Happy")
        tags = payload.get("tags", [])
        user_id = payload.get("user_id") or payload.get("userId") or "default_user"

        mem = database.create_memory(
            title=title,
            journal_text=journal_text,
            date=date_val,
            time=time_val,
            location=location,
            mood=mood,
            photos=photos,
            tags=tags,
            user_id=user_id,
        )
        return jsonify(mem), 201

    @app.route("/api/memories/<memory_id>", methods=["PUT"])
    def update_memory(memory_id):
        payload = request.get_json(silent=True) or {}
        title = payload.get("title", "").strip()
        journal_text = payload.get("journal_text") or payload.get("description") or payload.get("content") or ""
        photos = payload.get("photos", [])

        if not title and not journal_text.strip() and not photos:
            return jsonify({"error": "Please write something or attach photos for your diary entry"}), 400

        date_val = payload.get("date")
        time_val = payload.get("time")
        location = payload.get("location", "")
        mood = payload.get("mood", "😊 Happy")
        tags = payload.get("tags", [])

        mem = database.update_memory(
            memory_id=memory_id,
            title=title,
            journal_text=journal_text,
            date=date_val,
            time=time_val,
            location=location,
            mood=mood,
            photos=photos,
            tags=tags,
        )
        if not mem:
            return jsonify({"error": "Memory not found"}), 404
        return jsonify(mem), 200

    @app.route("/api/memories/<memory_id>", methods=["DELETE"])
    def delete_memory(memory_id):
        database.delete_memory(memory_id)
        return jsonify({"success": True, "deleted_id": memory_id}), 200

    @app.route("/api/memories/calendar-dots", methods=["GET"])
    def get_memory_calendar_dots():
        month_param = request.args.get("month")
        dots = database.get_memory_calendar_dots(month=month_param)
        return jsonify(dots), 200

    @app.route("/api/tasks/calendar-dots", methods=["GET"])
    def get_task_calendar_dots():
        month_param = request.args.get("month")
        dots = database.get_task_calendar_dots(month=month_param)
        return jsonify(dots), 200

    @app.route("/api/dashboard/date-activity", methods=["GET"])
    def get_date_activity():
        """
        Returns summary of items (memories and tasks) for a given date YYYY-MM-DD.
        Used by the Home compact calendar widget.
        """
        date_param = request.args.get("date") or datetime.now().strftime("%Y-%m-%d")
        memories = database.get_memories(date=date_param)
        tasks = database.get_tasks(task_date=date_param)
        
        mem_item = memories[0] if memories else None
        return jsonify({
            "date": date_param,
            "memory": mem_item,
            "memories_count": len(memories),
            "tasks_count": len(tasks),
            "tasks_pending": sum(1 for t in tasks if not t.get("is_completed")),
            "tasks": tasks[:5]
        }), 200

    @app.route("/api/memories/upload", methods=["POST"])
    def upload_memory_photos():
        """Uploads memory photos to Supabase Storage (local fallback for development)."""
        uploaded_urls = []
        upload_dir = os.path.join(app.static_folder, "uploads", "memories")
        os.makedirs(upload_dir, exist_ok=True)

        def persist_image(raw_bytes, original_name="photo.jpg"):
            if not raw_bytes:
                return None
            if len(raw_bytes) > 20 * 1024 * 1024:
                raise ValueError("Each photo must be smaller than 20 MB.")
            try:
                final_bytes, content_type, forced_ext = optimize_image_bytes(raw_bytes)
            except Exception as exc:
                raise ValueError(f"Could not read this image: {exc}")
            ext = forced_ext or os.path.splitext(original_name or "")[1].lower() or ".jpg"
            if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                ext = ".jpg"
            if forced_ext:
                ext = forced_ext
            filename = f"mem_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:10]}{ext}"
            object_path = f"default_user/{filename}"

            try:
                cloud_url = upload_bytes_to_supabase("daybook-memories", object_path, final_bytes, content_type)
                if cloud_url:
                    return cloud_url
            except Exception as exc:
                app.logger.exception("Memory photo Supabase upload failed")
                return None

            # Local development fallback only when Supabase isn't configured.
            supabase_url, supabase_key = _supabase_storage_config()
            if supabase_url and supabase_key:
                return None
            local_path = os.path.join(upload_dir, filename)
            with open(local_path, "wb") as fh:
                fh.write(final_bytes)
            return f"/static/uploads/memories/{filename}"

        try:
            if request.files:
                file_list = request.files.getlist("photos") or request.files.getlist("photo") or list(request.files.values())
                for file in file_list:
                    if not file or not file.filename:
                        continue
                    raw = file.read()
                    url = persist_image(raw, file.filename)
                    if not url:
                        return jsonify({"error": "Photo storage failed. Check Supabase Storage buckets and server key."}), 500
                    uploaded_urls.append(url)

            payload = request.get_json(silent=True) or {}
            b64_photos = payload.get("photos", [])
            if isinstance(b64_photos, str):
                b64_photos = [b64_photos]
            for data_url in b64_photos:
                if not isinstance(data_url, str):
                    continue
                if data_url.startswith("http://") or data_url.startswith("https://") or data_url.startswith("/static/"):
                    uploaded_urls.append(data_url)
                    continue
                match = re.match(r"^data:image/[^;]+;base64,(.+)$", data_url, re.IGNORECASE | re.DOTALL)
                if not match:
                    continue
                raw = base64.b64decode(match.group(1))
                url = persist_image(raw)
                if not url:
                    return jsonify({"error": "Photo storage failed. Check Supabase Storage buckets and server key."}), 500
                uploaded_urls.append(url)

            if not uploaded_urls:
                return jsonify({"error": "No valid photos received."}), 400
            return jsonify({"success": True, "urls": uploaded_urls}), 200
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:
            app.logger.exception("Memory photo upload crashed")
            return jsonify({"error": f"Photo upload failed: {exc}"}), 500

    @app.route("/api/search", methods=["GET"])
    def search():
        q = request.args.get("q", "")
        results = database.search_all(q)
        return jsonify(results), 200

    # -------------------------------------------------------------
    # User Preferences API (Section 22 - 8 & Section 19)
    # -------------------------------------------------------------
    @app.route("/api/preferences", methods=["GET"])
    def get_preferences():
        prefs = database.get_preferences()
        return jsonify(prefs), 200

    @app.route("/api/preferences", methods=["POST"])
    def update_preferences():
        payload = request.get_json(silent=True) or {}
        updated = database.update_preferences(payload)
        return jsonify(updated), 200

    # -------------------------------------------------------------
    # Companion Custom Photo API (Customizable Animal Companions)
    # -------------------------------------------------------------
    @app.route("/api/companion/upload", methods=["POST"])
    def upload_companion_photo():
        """Stores custom companion image in Supabase Storage."""
        try:
            raw = None
            filename = "companion.jpg"
            if request.files:
                file = request.files.get("photo") or request.files.get("image") or next(iter(request.files.values()), None)
                if file:
                    filename = file.filename or filename
                    raw = file.read()
            if raw is None:
                payload = request.get_json(silent=True) or {}
                data_url = payload.get("photo_data") or payload.get("image_data")
                if data_url:
                    match = re.match(r"^data:image/[^;]+;base64,(.+)$", data_url, re.IGNORECASE | re.DOTALL)
                    if match:
                        raw = base64.b64decode(match.group(1))
            if not raw:
                return jsonify({"error": "No image data provided"}), 400
            if len(raw) > 20 * 1024 * 1024:
                return jsonify({"error": "Image must be smaller than 20 MB"}), 400

            final_bytes, content_type, _ = optimize_image_bytes(raw, max_dim=1200, quality=86)
            object_path = f"default_user/custom_avatar_{uuid.uuid4().hex[:8]}.jpg"
            image_url = upload_bytes_to_supabase("daybook-backgrounds", object_path, final_bytes, content_type)
            if not image_url:
                upload_dir = os.path.join(app.static_folder, "uploads", "companions")
                os.makedirs(upload_dir, exist_ok=True)
                file_path = os.path.join(upload_dir, "custom_avatar.jpg")
                with open(file_path, "wb") as fh:
                    fh.write(final_bytes)
                image_url = "/static/uploads/companions/custom_avatar.jpg"

            database.update_preferences({"companion_id": "custom", "companion_image_url": image_url})
            return jsonify({"success": True, "imageUrl": image_url, "image_url": image_url}), 200
        except Exception as exc:
            app.logger.exception("Companion upload failed")
            return jsonify({"error": f"Failed to save image: {exc}"}), 500

    @app.route("/api/companion/photo", methods=["DELETE"])
    def delete_companion_photo():
        prefs = database.get_preferences()
        old_url = prefs.get("companion_image_url") if prefs else None
        if old_url:
            delete_supabase_public_url(old_url)
        database.update_preferences({"companion_image_url": None, "companion_id": "bear"})
        return jsonify({"success": True}), 200

    @app.route("/api/background/upload", methods=["POST"])
    def upload_background_photo():
        """Stores a custom background in Supabase Storage and saves its URL in preferences."""
        try:
            raw = None
            filename = "background.jpg"
            if request.files:
                file = request.files.get("photo") or request.files.get("image") or next(iter(request.files.values()), None)
                if file:
                    filename = file.filename or filename
                    raw = file.read()
            payload = request.get_json(silent=True) or {}
            if raw is None:
                data_url = payload.get("photo_data") or payload.get("image_data")
                if data_url:
                    match = re.match(r"^data:image/[^;]+;base64,(.+)$", data_url, re.IGNORECASE | re.DOTALL)
                    if match:
                        raw = base64.b64decode(match.group(1))
            if not raw:
                return jsonify({"error": "No image data provided"}), 400
            if len(raw) > 20 * 1024 * 1024:
                return jsonify({"error": "Background image must be smaller than 20 MB"}), 400

            final_bytes, content_type, _ = optimize_image_bytes(raw, max_dim=2200, quality=86)
            object_path = f"default_user/background_{uuid.uuid4().hex[:10]}.jpg"
            image_url = upload_bytes_to_supabase("daybook-backgrounds", object_path, final_bytes, content_type)
            if not image_url:
                upload_dir = os.path.join(app.static_folder, "uploads", "backgrounds")
                os.makedirs(upload_dir, exist_ok=True)
                local_path = os.path.join(upload_dir, "custom_bg.jpg")
                with open(local_path, "wb") as fh:
                    fh.write(final_bytes)
                image_url = "/static/uploads/backgrounds/custom_bg.jpg"

            update = {"custom_bg_enabled": 1, "custom_bg_image_url": image_url}
            for field in ("fit", "position", "overlay_mode", "overlay_opacity", "blur", "dynamic_accent", "accent_color"):
                if field not in payload:
                    continue
                mapping = {
                    "fit": "custom_bg_fit", "position": "custom_bg_position",
                    "overlay_mode": "custom_bg_overlay_mode", "overlay_opacity": "custom_bg_overlay_opacity",
                    "blur": "custom_bg_blur", "dynamic_accent": "custom_bg_dynamic_accent",
                    "accent_color": "custom_bg_accent_color",
                }
                update[mapping[field]] = payload[field]
            database.update_preferences(update)
            return jsonify({"success": True, "imageUrl": image_url, "image_url": image_url}), 200
        except Exception as exc:
            app.logger.exception("Background upload failed")
            return jsonify({"error": f"Failed to save background image: {exc}"}), 500

    @app.route("/api/background/photo", methods=["DELETE"])
    def delete_background_photo():
        prefs = database.get_preferences()
        old_url = prefs.get("custom_bg_image_url") if prefs else None
        if old_url:
            delete_supabase_public_url(old_url)
        database.update_preferences({"custom_bg_enabled": 0, "custom_bg_image_url": None})
        return jsonify({"success": True, "message": "Default background restored"}), 200

    @app.route("/api/inbox", methods=["GET"])
    def list_inbox_items():
        status = request.args.get("status", "inbox")
        items = database.get_inbox_items(status=status)
        return jsonify(items), 200

    @app.route("/api/inbox", methods=["POST"])
    def create_inbox_item():
        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or payload.get("content") or "").strip()
        if not title:
            return jsonify({"error": "Title or content is required"}), 400
        notes = payload.get("notes", "")
        item_type = payload.get("item_type", "unprocessed")
        item = database.create_inbox_item(title=title, notes=notes, item_type=item_type)
        return jsonify(item), 201

    @app.route("/api/inbox/<item_id>", methods=["PUT"])
    def update_inbox_item(item_id):
        payload = request.get_json(silent=True) or {}
        updated = database.update_inbox_item(item_id, payload)
        if not updated:
            return jsonify({"error": "Inbox item not found"}), 404
        return jsonify(updated), 200

    @app.route("/api/inbox/<item_id>", methods=["DELETE"])
    def delete_inbox_item(item_id):
        success = database.delete_inbox_item(item_id)
        return jsonify({"success": success, "deleted_id": item_id}), 200

    @app.route("/api/inbox/<item_id>/convert", methods=["POST"])
    def convert_inbox_item(item_id):
        payload = request.get_json(silent=True) or {}
        target_type = payload.get("target_type", "task")
        target_data = payload.get("target_data", {})
        result = database.convert_inbox_item(item_id, target_type, target_data)
        if not result:
            return jsonify({"error": "Inbox item not found"}), 404
        return jsonify(result), 200

    # -------------------------------------------------------------
    # Victory Sounds API & Secure Storage Engine
    # -------------------------------------------------------------
    def store_audio_file(audio_bytes, ext, user_id="default_user"):
        """Stores custom audio in Supabase Storage and returns a playable browser URL."""
        unique_id = uuid.uuid4().hex[:10]
        filename = f"sound_{unique_id}.{ext}"
        object_path = f"{user_id}/{filename}"
        mime_map = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "m4a": "audio/mp4", "webm": "audio/webm"}
        try:
            cloud_url = upload_bytes_to_supabase("daybook-sounds", object_path, audio_bytes, mime_map.get(ext, "application/octet-stream"))
            if cloud_url:
                return cloud_url
        except Exception:
            app.logger.exception("Sound upload to Supabase failed")
            raise

        upload_dir = os.path.join(app.static_folder, "uploads", "sounds")
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, filename)
        with open(local_path, "wb") as f:
            f.write(audio_bytes)
        return f"/static/uploads/sounds/{filename}"

    def remove_audio_file(file_path):
        """Removes a custom audio file from Supabase Storage or local development disk."""
        if not file_path:
            return
        if file_path.startswith("/api/storage/") or (file_path.startswith("http") and "/storage/v1/object/public/" in file_path):
            delete_supabase_public_url(file_path)
        elif file_path.startswith("/static/"):
            rel_path = file_path.replace("/static/", "", 1)
            full_path = os.path.join(app.static_folder, rel_path)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception:
                    pass

    @app.route("/api/sounds", methods=["GET"])
    def list_victory_sounds():
        """Lists all victory sounds (built-in defaults + user uploaded)."""
        sounds = database.get_victory_sounds()
        return jsonify(sounds), 200

    @app.route("/api/sounds", methods=["POST"])
    def upload_victory_sound():
        """
        Uploads custom audio from device storage with strict validation,
        SHA-256 duplicate detection, and private storage isolation.
        """
        title = request.form.get("title", "").strip()
        event_trigger = request.form.get("event_trigger", "task_complete")
        is_default = 1 if request.form.get("is_default") in ("true", "1", True) else 0
        reported_duration = float(request.form.get("duration") or 0.0)

        audio_bytes = None
        orig_filename = ""

        audio_file = request.files.get("audio")
        if audio_file:
            orig_filename = audio_file.filename or "audio.mp3"
            audio_bytes = audio_file.read()
        else:
            payload = request.get_json(silent=True) or {}
            title = payload.get("title", title).strip()
            event_trigger = payload.get("event_trigger", event_trigger)
            is_default = 1 if payload.get("is_default") else 0
            reported_duration = float(payload.get("duration") or reported_duration)
            base64_data = payload.get("audio_data") or ""
            orig_filename = payload.get("filename", "audio.mp3")

            if base64_data:
                if "," in base64_data:
                    base64_data = base64_data.split(",")[1]
                try:
                    audio_bytes = base64.b64decode(base64_data)
                except Exception:
                    return jsonify({"error": "Malformed base64 audio data."}), 400

        if not audio_bytes:
            return jsonify({"error": "Please select a valid audio file from your device."}), 400

        # Server-side validation
        is_valid, ext, calculated_duration, err_msg = validate_audio_binary(audio_bytes, orig_filename)
        if not is_valid:
            return jsonify({"error": err_msg}), 400

        final_duration = calculated_duration if calculated_duration > 0 else reported_duration
        if not title:
            title = orig_filename.rsplit(".", 1)[0].replace("_", " ").title() or "Custom Sound"

        # SHA-256 Duplicate Upload Check
        file_hash = hashlib.sha256(audio_bytes).hexdigest()
        existing_duplicate = database.find_victory_sound_by_hash(file_hash)
        if existing_duplicate:
            return jsonify({
                "message": f"Identical sound already exists in your library: '{existing_duplicate['title']}'.",
                "sound": existing_duplicate,
                "is_duplicate": True,
            }), 200

        # Persist audio binary
        file_path = store_audio_file(audio_bytes, ext)

        sound = database.create_victory_sound(
            title=title,
            file_path=file_path,
            file_format=ext,
            file_size=len(audio_bytes),
            duration=final_duration,
            event_trigger=event_trigger,
            is_default=is_default,
            file_hash=file_hash,
        )
        return jsonify(sound), 201

    @app.route("/api/sounds/<sound_id>/replace", methods=["POST"])
    def replace_victory_sound(sound_id):
        """
        Replaces the audio file of an existing sound while preserving
        its sound_id, user preferences, and milestone associations.
        """
        existing = database.get_victory_sound_by_id(sound_id)
        if not existing:
            return jsonify({"error": "Sound not found"}), 404

        audio_bytes = None
        orig_filename = ""
        reported_duration = float(request.form.get("duration") or 0.0)

        audio_file = request.files.get("audio")
        if audio_file:
            orig_filename = audio_file.filename or "audio.mp3"
            audio_bytes = audio_file.read()
        else:
            payload = request.get_json(silent=True) or {}
            reported_duration = float(payload.get("duration") or reported_duration)
            base64_data = payload.get("audio_data") or ""
            orig_filename = payload.get("filename", "audio.mp3")
            if base64_data:
                if "," in base64_data:
                    base64_data = base64_data.split(",")[1]
                try:
                    audio_bytes = base64.b64decode(base64_data)
                except Exception:
                    return jsonify({"error": "Malformed base64 audio data."}), 400

        if not audio_bytes:
            return jsonify({"error": "Please provide a replacement audio file."}), 400

        is_valid, ext, calculated_duration, err_msg = validate_audio_binary(audio_bytes, orig_filename)
        if not is_valid:
            return jsonify({"error": err_msg}), 400

        final_duration = calculated_duration if calculated_duration > 0 else reported_duration
        file_hash = hashlib.sha256(audio_bytes).hexdigest()

        # Store new file and clean up old file
        new_file_path = store_audio_file(audio_bytes, ext)
        updated = database.replace_victory_sound_file(
            sound_id=sound_id,
            file_path=new_file_path,
            file_format=ext,
            file_size=len(audio_bytes),
            duration=final_duration,
            file_hash=file_hash,
        )

        old_file = updated.pop("_old_file_path", None)
        if old_file and not old_file.startswith("/static/uploads/sounds/crystal_chime"):
            remove_audio_file(old_file)

        return jsonify(updated), 200

    @app.route("/api/sounds/<sound_id>", methods=["PUT"])
    def update_victory_sound(sound_id):
        """Renames or updates configuration of an existing victory sound."""
        payload = request.get_json(silent=True) or {}
        updated = database.update_victory_sound(sound_id, payload)
        if not updated:
            return jsonify({"error": "Sound not found"}), 404
        return jsonify(updated), 200

    @app.route("/api/sounds/<sound_id>", methods=["DELETE"])
    def delete_victory_sound(sound_id):
        """Deletes custom victory sound and purges audio binary."""
        sound = database.delete_victory_sound(sound_id)
        if not sound:
            return jsonify({"error": "Cannot delete built-in sound or sound not found"}), 400

        remove_audio_file(sound.get("file_path"))
        return jsonify({"success": True, "deleted_id": sound_id}), 200

    # -------------------------------------------------------------
    # Data Export API (Section 22 - 6)
    # -------------------------------------------------------------
    @app.route("/api/export", methods=["GET"])
    def export_data():
        """Returns complete application backup as downloadable JSON file."""
        data = database.export_all_data()
        filename = f"daybook_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        import json
        return Response(
            json.dumps(data, indent=2),
            mimetype="application/json",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )

    # -------------------------------------------------------------
    # Error Handlers
    # -------------------------------------------------------------
    @app.errorhandler(404)
    def handle_not_found(error):
        return jsonify({"error": "Not Found", "message": "Resource was not found"}), 404

    @app.errorhandler(500)
    def handle_server_error(error):
        return jsonify({"error": "Server Error", "message": str(error)}), 500

    return app


app = create_app()

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"

    print("=" * 64)
    print(" [*] DAYBOOK SERVER INITIALIZED (v1.3.0)")
    print(f"  -> Local PC Browser:   http://localhost:{port}")
    print(f"  -> Android on Wi-Fi:   http://<YOUR-PC-IP>:{port}")
    print(f"  -> Storage Mode:       {'PostgreSQL' if database.IS_POSTGRES else 'SQLite (Local Dev)'}")
    print(f"  -> Debug Mode:         {'Enabled' if debug else 'Disabled'}")
    print("=" * 64)

    app.run(host=host, port=port, debug=debug)
