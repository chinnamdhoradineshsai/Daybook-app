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


def create_app():
    """Application factory to configure and return the Flask application."""
    app = Flask(__name__)

    # Core configuration
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "daybook-insecure-dev-key")
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8MB max upload

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
        """
        Accepts multiple images (multipart files or base64 JSON payload),
        validates extensions, saves to static/uploads/memories/,
        and returns list of accessible URLs.
        """
        allowed_extensions = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        upload_dir = os.path.join(app.static_folder, "uploads", "memories")
        os.makedirs(upload_dir, exist_ok=True)
        uploaded_urls = []

        # 1. Handle multipart files
        if request.files:
            file_list = request.files.getlist("photos") or request.files.getlist("photo") or [f for f in request.files.values()]
            for file in file_list:
                if not file.filename:
                    continue
                ext = os.path.splitext(file.filename)[1].lower()
                if ext not in allowed_extensions:
                    ext = ".jpg"

                # Always save as JPEG for smaller file sizes (except webp/gif)
                save_ext = ext if ext in {".webp", ".gif"} else ".jpg"
                unique_name = f"mem_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}{save_ext}"
                file_dest = os.path.join(upload_dir, unique_name)

                if PILLOW_AVAILABLE and save_ext in {".jpg", ".webp"}:
                    try:
                        img = PILImage.open(file.stream)
                        # Convert RGBA/P to RGB for JPEG compatibility
                        if img.mode in ("RGBA", "P", "LA"):
                            img = img.convert("RGB")
                        # Resize if wider than 1800px (keep aspect ratio, high quality)
                        max_dim = 1800
                        if img.width > max_dim or img.height > max_dim:
                            img.thumbnail((max_dim, max_dim), PILImage.LANCZOS)
                        img.save(file_dest, "JPEG" if save_ext == ".jpg" else "WEBP",
                                 quality=85, optimize=True)
                    except Exception:
                        file.stream.seek(0)
                        file.save(file_dest)
                else:
                    file.save(file_dest)

                uploaded_urls.append(f"/static/uploads/memories/{unique_name}")


        # 2. Handle base64 JSON payload
        payload = request.get_json(silent=True) or {}
        b64_photos = payload.get("photos", [])
        if isinstance(b64_photos, str):
            b64_photos = [b64_photos]
        for data_url in b64_photos:
            if not isinstance(data_url, str):
                continue
            if data_url.startswith("/static/") or data_url.startswith("http"):
                uploaded_urls.append(data_url)
                continue
            match = re.match(r"^data:image\/([a-zA-Z0-9\+\-]+);base64,(.+)$", data_url)
            if match:
                raw_ext = match.group(1).lower()
                ext = ".png" if "png" in raw_ext else ".webp" if "webp" in raw_ext else ".jpg"
                save_ext = ext if ext in {".webp", ".gif"} else ".jpg"
                b64_data = match.group(2)
                try:
                    raw_bytes = base64.b64decode(b64_data)
                    unique_name = f"mem_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}{save_ext}"
                    file_dest = os.path.join(upload_dir, unique_name)
                    if PILLOW_AVAILABLE and save_ext in {".jpg", ".webp"}:
                        try:
                            img = PILImage.open(io.BytesIO(raw_bytes))
                            if img.mode in ("RGBA", "P", "LA"):
                                img = img.convert("RGB")
                            max_dim = 1800
                            if img.width > max_dim or img.height > max_dim:
                                img.thumbnail((max_dim, max_dim), PILImage.LANCZOS)
                            img.save(file_dest, "JPEG" if save_ext == ".jpg" else "WEBP", quality=85, optimize=True)
                        except Exception:
                            with open(file_dest, "wb") as f:
                                f.write(raw_bytes)
                    else:
                        with open(file_dest, "wb") as f:
                            f.write(raw_bytes)
                    uploaded_urls.append(f"/static/uploads/memories/{unique_name}")
                except Exception as e:
                    app.logger.warning(f"Error decoding base64 image: {e}")

        return jsonify({"success": True, "urls": uploaded_urls}), 200

    # -------------------------------------------------------------
    # Search API (Section 22 - 3)
    # -------------------------------------------------------------
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
        """
        Accepts a custom companion photo (multipart file or base64 JSON),
        validates format (PNG, JPEG, WebP) and size (< 5MB), stores locally/cloud,
        and saves in user preferences.
        """
        allowed_extensions = {".png", ".jpg", ".jpeg", ".webp"}
        upload_dir = os.path.join(app.static_folder, "uploads", "companions")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, "custom_avatar.png")
        relative_url = "/static/uploads/companions/custom_avatar.png"

        # 1. Handle multipart file upload
        if "photo" in request.files:
            file = request.files["photo"]
            if not file.filename:
                return jsonify({"error": "No file selected"}), 400
            
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in allowed_extensions:
                return jsonify({"error": "Unsupported file format. Please upload PNG, JPG, or WebP."}), 400
            
            file.save(file_path)
            database.update_preferences({
                "companion_id": "custom",
                "companion_image_url": relative_url
            })
            return jsonify({
                "success": True,
                "imageUrl": relative_url,
                "companion_id": "custom",
                "message": "Custom photo uploaded successfully"
            }), 200

        # 2. Handle base64 JSON payload
        payload = request.get_json(silent=True) or {}
        data_url = payload.get("photo_data")
        if data_url and isinstance(data_url, str):
            match = re.match(r"^data:image\/(png|jpeg|jpg|webp);base64,(.+)$", data_url, re.IGNORECASE)
            if not match:
                return jsonify({"error": "Invalid base64 image data"}), 400
            
            b64_data = match.group(2)
            try:
                raw_bytes = base64.b64decode(b64_data)
                if len(raw_bytes) > 5 * 1024 * 1024:
                    return jsonify({"error": "File size exceeds 5MB limit"}), 400
                
                with open(file_path, "wb") as f:
                    f.write(raw_bytes)

                database.update_preferences({
                    "companion_id": "custom",
                    "companion_image_url": relative_url
                })
                return jsonify({
                    "success": True,
                    "imageUrl": relative_url,
                    "companion_id": "custom",
                    "message": "Custom photo saved successfully"
                }), 200
            except Exception as e:
                return jsonify({"error": f"Failed to save image: {str(e)}"}), 500

        return jsonify({"error": "No image data provided"}), 400

    @app.route("/api/companion/photo", methods=["DELETE"])
    def delete_companion_photo():
        """Removes the custom companion photo and resets companion selection."""
        upload_dir = os.path.join(app.static_folder, "uploads", "companions")
        file_path = os.path.join(upload_dir, "custom_avatar.png")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        
        database.update_preferences({
            "companion_id": "bear",
            "companion_image_url": None
        })
        return jsonify({"success": True}), 200

    # -------------------------------------------------------------
    # Custom Photo Background & Dynamic Theme API
    # -------------------------------------------------------------
    @app.route("/api/background/upload", methods=["POST"])
    def upload_background_photo():
        """
        Accepts custom background photo (multipart file or base64 JSON),
        validates format (JPEG, PNG, WebP) and size (< 10MB), stores locally/cloud,
        and saves in user preferences.
        """
        allowed_extensions = {".png", ".jpg", ".jpeg", ".webp"}
        upload_dir = os.path.join(app.static_folder, "uploads", "backgrounds")
        os.makedirs(upload_dir, exist_ok=True)
        
        # 1. Handle multipart file upload
        if "photo" in request.files:
            file = request.files["photo"]
            if not file.filename:
                return jsonify({"error": "No file selected"}), 400
            
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in allowed_extensions:
                return jsonify({"error": "Unsupported image format. Please upload JPEG, PNG, or WebP."}), 400
            
            filename = f"custom_bg{ext}"
            file_path = os.path.join(upload_dir, filename)
            relative_url = f"/static/uploads/backgrounds/{filename}"
            
            file.save(file_path)
            database.update_preferences({
                "custom_bg_enabled": 1,
                "custom_bg_image_url": relative_url
            })
            return jsonify({
                "success": True,
                "imageUrl": relative_url,
                "image_url": relative_url,
                "message": "Custom background photo uploaded successfully"
            }), 200

        # 2. Handle base64 JSON payload
        payload = request.get_json(silent=True) or {}
        data_url = payload.get("photo_data") or payload.get("image_data")
        if data_url and isinstance(data_url, str):
            match = re.match(r"^data:image\/(png|jpeg|jpg|webp);base64,(.+)$", data_url, re.IGNORECASE)
            if not match:
                return jsonify({"error": "Invalid base64 image data"}), 400
            
            format_ext = match.group(1).lower()
            if format_ext == "jpeg":
                format_ext = "jpg"
            b64_data = match.group(2)
            try:
                raw_bytes = base64.b64decode(b64_data)
                if len(raw_bytes) > 10 * 1024 * 1024:
                    return jsonify({"error": "File size exceeds 10MB limit"}), 400
                
                filename = f"custom_bg.{format_ext}"
                file_path = os.path.join(upload_dir, filename)
                relative_url = f"/static/uploads/backgrounds/{filename}"

                with open(file_path, "wb") as f:
                    f.write(raw_bytes)

                database.update_preferences({
                    "custom_bg_enabled": 1,
                    "custom_bg_image_url": relative_url
                })
                return jsonify({
                    "success": True,
                    "imageUrl": relative_url,
                    "image_url": relative_url,
                    "message": "Custom background photo saved successfully"
                }), 200
            except Exception as e:
                return jsonify({"error": f"Failed to save background image: {str(e)}"}), 500

        return jsonify({"error": "No image data provided"}), 400

    @app.route("/api/background/photo", methods=["DELETE"])
    def delete_background_photo():
        """Removes the custom background photo and restores default background."""
        upload_dir = os.path.join(app.static_folder, "uploads", "backgrounds")
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            file_path = os.path.join(upload_dir, f"custom_bg{ext}")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
        
        database.update_preferences({
            "custom_bg_enabled": 0,
            "custom_bg_image_url": None
        })
        return jsonify({"success": True, "message": "Default background restored"}), 200

    # -------------------------------------------------------------
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
        """
        Stores audio either in Supabase Storage bucket 'daybook-sounds'
        or local static uploads folder when running in local development mode.
        """
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        unique_id = uuid.uuid4().hex[:10]
        filename = f"sound_{unique_id}.{ext}"

        if supabase_url and supabase_key:
            try:
                import requests
                storage_path = f"{user_id}/{filename}"
                upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/daybook-sounds/{storage_path}"
                headers = {
                    "Authorization": f"Bearer {supabase_key}",
                    "apikey": supabase_key,
                    "Content-Type": f"audio/{ext}",
                }
                res = requests.post(upload_url, data=audio_bytes, headers=headers, timeout=10)
                if res.status_code in (200, 201):
                    return f"daybook-sounds/{storage_path}"
            except Exception as e:
                print(f"[Supabase Storage] Upload error, falling back to local: {e}")

        # Local development storage fallback
        upload_dir = os.path.join(app.static_folder, "uploads", "sounds")
        os.makedirs(upload_dir, exist_ok=True)
        local_path = os.path.join(upload_dir, filename)
        with open(local_path, "wb") as f:
            f.write(audio_bytes)
        return f"/static/uploads/sounds/{filename}"

    def remove_audio_file(file_path):
        """Removes an audio file safely from Supabase Storage or local disk."""
        if not file_path:
            return
        if file_path.startswith("daybook-sounds/"):
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if supabase_url and supabase_key:
                try:
                    import requests
                    obj_path = file_path.replace("daybook-sounds/", "", 1)
                    del_url = f"{supabase_url.rstrip('/')}/storage/v1/object/daybook-sounds/{obj_path}"
                    requests.delete(del_url, headers={"Authorization": f"Bearer {supabase_key}", "apikey": supabase_key}, timeout=5)
                except Exception:
                    pass
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
