# Daybook — Mobile-First Personal Workspace

> A Notion-inspired productivity application built with Vanilla HTML5, CSS3, JavaScript, Python Flask, and Supabase PostgreSQL.

---

## 🏗️ Project Architecture & Data Flow

```
┌─────────────────────────────────┐
│     Mobile Browser (Android)    │
│   HTML5 • CSS3 • Vanilla JS     │
└───────────────┬─────────────────┘
                │  Fetch API (JSON requests)
                ▼
┌─────────────────────────────────┐
│      Python Flask Backend       │
│  Validation • Business Logic    │
└───────────────┬─────────────────┘
                │  PostgreSQL Driver / Supabase Client
                ▼
┌─────────────────────────────────┐
│     Supabase / PostgreSQL       │
│  Relational Storage • RLS Auth  │
└─────────────────────────────────┘
```

---

## 📁 Project Structure

```
daybook/
├── app.py              # Flask server & API routes
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
├── .gitignore          # Git exclusion rules
├── templates/
│   └── index.html      # Mobile-first workspace layout
├── static/
│   ├── css/
│   │   └── style.css   # Notion-like design system, tokens & dark mode
│   └── js/
│       └── app.js      # Client controller & state management
└── README.md           # Documentation & guides
```

---

## 🚀 How to Run Locally

1. Open PowerShell or Terminal in the project directory:
   ```powershell
   cd d:\Task
   ```

2. Run the Flask development server:
   ```powershell
   python app.py
   ```

3. Open in your computer browser:
   [http://localhost:5000](http://localhost:5000)

---

## 📱 How to Open on Your Android Phone

1. Make sure your computer and your Android phone are connected to the **same Wi-Fi network**.
2. Find your computer's local IP address:
   - On Windows, open PowerShell and type: `ipconfig`
   - Look for the **IPv4 Address** under your Wi-Fi adapter (e.g., `192.168.1.50`).
3. On your Android phone, open Chrome and navigate to:
   ```
   http://<YOUR-PC-IP>:5000
   ```
   *(For example: `http://192.168.1.50:5000`)*

> **Why doesn't `localhost:5000` work on your phone?**  
> `localhost` is a special networking alias that means *"this device itself"*. When you type `localhost` on your phone, your phone looks inside itself for a server, not at your computer. Using your computer's local Wi-Fi IP address tells your phone to connect across your home network directly to your computer.
