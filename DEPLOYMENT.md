# 🚀 Daybook — Production Deployment & Hosting Guide

This guide provides step-by-step instructions for deploying Daybook to production using **Vercel** (Frontend/PWA), **Render** (Python Flask Backend), and **Supabase** (PostgreSQL & Storage).

---

## Architecture Overview

```mermaid
graph TD
    Client["📱 Mobile PWA / Desktop Browser"]
    Vercel["⚡ Vercel (Static Frontend & PWA)"]
    Render["🐍 Render (Flask API + Gunicorn)"]
    SupabaseDB["🐘 Supabase (PostgreSQL Database)"]
    SupabaseStore["📦 Supabase Storage (Companion Photos)"]

    Client -->|HTTPS / PWA Shell| Vercel
    Client -->|HTTPS REST API (CORS)| Render
    Render -->|psycopg2 pooler| SupabaseDB
    Render -->|REST API| SupabaseStore
```

---

## 1. Supabase Database & Storage Setup

1. **Create a Supabase Project**:
   - Go to [database.new](https://database.new) and sign in.
   - Choose a project name (e.g., `daybook-production`) and a strong database password.
   - Select your nearest region.

2. **Execute Database Schema & Policies**:
   - In your Supabase dashboard, go to the **SQL Editor** tab on the left sidebar.
   - Click **New Query**, open [`supabase_setup.sql`](file:///d:/Task/supabase_setup.sql), copy its contents, paste them into the SQL editor, and click **Run**.
   - This creates all tables (`notes`, `projects`, `project_milestones`, `tasks`, `journals`, `user_preferences`), indexes, Row Level Security (RLS) policies, and the `daybook-companions` storage bucket.

3. **Get Your Connection String**:
   - In Supabase, go to **Project Settings** → **Database** → **Connection String**.
   - Select **URI** (Session Pooler mode on port 6543 or Direct on port 5432).
   - Copy the URI:
     ```text
     postgresql://postgres.[YOUR-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```

---

## 2. Render Flask Backend Deployment

1. **Push your code to GitHub / GitLab**:
   ```bash
   git add .
   git commit -m "feat: customizable companions & production deployment configuration"
   git push origin main
   ```

2. **Create Web Service on Render**:
   - Sign in to [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** → **Web Service**.
   - Connect your Daybook repository.
   - Configure the service settings:
     - **Name**: `daybook-api`
     - **Region**: Closest to your Supabase database region.
     - **Branch**: `main`
     - **Root Directory**: (Leave blank or `.`)
     - **Runtime**: `Python 3`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 4 --threads 2 --timeout 120`

3. **Configure Render Environment Variables**:
   Under **Environment Variables**, add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `FLASK_ENV` | `production` | Production mode |
   | `FLASK_DEBUG` | `0` | Disable debug reloader |
   | `SECRET_KEY` | *(Click Generate)* | Session protection |
   | `DATABASE_URL` | `postgresql://postgres...` | Your Supabase connection URI |
   | `ALLOWED_ORIGINS` | `https://*.vercel.app,http://localhost:5000` | CORS allowed frontend origins |

4. **Verify Health Check**:
   - Render will deploy the app. Once active, visit:
     `https://daybook-api.onrender.com/api/health`
   - It should return:
     ```json
     {
       "status": "healthy",
       "app": "Daybook",
       "version": "1.3.0",
       "database_type": "PostgreSQL (Supabase)",
       "database_configured": true
     }
     ```

---

## 3. Vercel Frontend & PWA Deployment

1. **Import Project to Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **Add New...** → **Project**.
   - Select your Daybook Git repository.

2. **Configure Build & Output**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./`
   - `vercel.json` will automatically configure routing, PWA service worker headers, and rewrites.

3. **Set Frontend Environment Variable**:
   In **Environment Variables**, add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://daybook-api.onrender.com` | Your deployed Render API URL |

4. **Deploy**:
   - Click **Deploy**. Vercel will provide a live HTTPS URL (e.g., `https://daybook-app.vercel.app`).
   - Add your exact Vercel URL to the `ALLOWED_ORIGINS` variable in your Render dashboard.

---

## 4. Post-Deployment Verification Checklist

- [x] **Backend Health Check**: Open `https://<YOUR-RENDER-URL>/api/health` and verify database connects to PostgreSQL.
- [x] **Animal Companion Gallery**: Open Settings → Personalization, choose an animal companion (e.g., Panda, Capybara, Dino), and verify preview celebration.
- [x] **Device Photo Picker & Cropper**: Select an image from phone or PC, crop and position using the sliders, and save.
- [x] **Offline Resilience**: Turn on Airplane mode / disable network in DevTools. Companion selection and tasks continue working from IndexedDB and Service Worker cache.
- [x] **Cloud Synchronization**: Reconnect network. Verify queued changes sync to Supabase without duplicates.
- [x] **Mobile PWA Installation**: On Android Chrome, tap "Add to Home screen" or "Install Daybook" to run as a full-screen standalone application.
