# 🚀 DEPLOYMENT GUIDE: VEERASHAIVA LINGAYATH BOYS HOSTEL
**Location:** Krushi Nagar, Shivamogga, Karnataka  
**Production Domain:** `https://veerashaivahostel.run.place`

---

## ⚡ 1. YOUR APPLICATION IS CURRENTLY LIVE RIGHT NOW!

Your server is running locally and connected to a secure public Cloudflare Tunnel. You and any student or staff member can open and use it **right now** from anywhere in the world:

🔗 **Live URL:**  
### 👉 [https://charges-enter-settle-ion.trycloudflare.com](https://charges-enter-settle-ion.trycloudflare.com)

- **Admin / Warden Login:**  
  - Username: `admin` (or `admin@smarthostel.com`)  
  - Password: `Admin@123`
- **Student Login (64 Students Pre-configured):**  
  - Username: `001` (or any ID from `001` to `064`)  
  - Password: `Student@123`
- **Cleaning Module:**  
  - Warden: `/cleaning` (Schedule cleaning, view logs, inspect ratings)  
  - Student: `/student/cleaning` (View scheduled cleaning for their assigned room, submit 1-5 star ratings, report issues)
- **Room Protection:**  
  - Only valid rooms: `Room 01`, `Room 02`, `Room 04` to `Room 13`  
  - `Room 03` is strictly prevented from existing.

---

## ☁️ 2. PERMANENT 24/7 FREE CLOUD HOSTING (RECOMMENDED)

To keep your website online **24/7 forever** without needing your laptop turned on and without relying on your home Jio Wi-Fi connection, follow these 4 simple steps:

### STEP 1: Create a Free GitHub Repository
1. Go to [https://github.com/new](https://github.com/new) and create a repository named `hostel-management` (keep it Private or Public).
2. Run these two commands in your terminal here:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/hostel-management.git
   git branch -M main
   git push -u origin main
   ```

---

### 🗄️ Step 2: Cloud Database (COMPLETED! ✓)
- **Status:** All 249 documents, 64 students, 12 rooms, users, mess menu, and cleaning records are **already migrated to your MongoDB Atlas cluster**!
- **Your Working MongoDB Atlas URI:**
  ```text
  mongodb+srv://nikhilnikki74831_db_user:<YOUR_PASSWORD>@cluster0.mpafhmb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
  ```

---

### ⚙️ Step 3: Deploy Backend API on Render (Free) — Takes 2 Minutes
1. Open **[https://dashboard.render.com](https://dashboard.render.com)** and log in with your GitHub account (`Nikhil7483`).
2. Click the blue button **New +** (top right) > Select **Web Service**.
3. Choose **Build and deploy from a Git repository** > Select **`Nikhil7483/Veerashaivahostel`**.
4. Configure these exact settings:
   - **Name:** `veerashaiva-hostel-api`
   - **Region:** `Singapore` (closest to India)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
5. Scroll down to **Environment Variables** and add these 5 keys:
   - `ENVIRONMENT` = `production`
   - `MONGODB_URI` = `mongodb+srv://nikhilnikki74831_db_user:<YOUR_PASSWORD>@cluster0.mpafhmb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
   - `DATABASE_NAME` = `smart_hostel`
   - `JWT_SECRET` = `smart_hostel_super_secure_jwt_secret_key_2026_production_grade`
   - `CORS_ORIGINS` = `["https://veerashaivahostel.run.place", "https://*.vercel.app"]`
6. Click **Create Web Service**.
7. In ~2 minutes, Render will show **Live** and give your backend URL:  
   `https://veerashaiva-hostel-api.onrender.com`

---

### STEP 4: Deploy Frontend on Vercel (Free)
1. Go to [https://vercel.com](https://vercel.com) and click **Add New...** > **Project**.
2. Select your `hostel-management` repository.
3. Configure:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://hostel-api.onrender.com/api/v1`
5. Click **Deploy**. Your frontend will be live in 60 seconds!

---

### STEP 5: Connect Your Domain (`veerashaivahostel.run.place`)
1. In Vercel Project Settings > **Domains**, enter: `veerashaivahostel.run.place`
2. Vercel will give you a CNAME record: `cname.vercel-dns.com`
3. Go to your domain control panel (e.g. DNSExit / run.place dashboard) and set:
   - **Type:** `CNAME`
   - **Host:** `@` (or `veerashaivahostel`)
   - **Value:** `cname.vercel-dns.com`
4. Vercel will automatically generate a free SSL certificate, and `https://veerashaivahostel.run.place` will be permanently online 24/7!
