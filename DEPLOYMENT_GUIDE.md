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

### STEP 2: Setup Free MongoDB Atlas Database
1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) and create a free M0 cluster.
2. Under **Network Access**, add IP Address `0.0.0.0/0` (Allow access from anywhere).
3. Under **Database Access**, create a user `hosteladmin` with a secure password.
4. Click **Connect** > **Drivers** and copy your connection string:
   `mongodb+srv://hosteladmin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`
5. Migrate all 64 students and 12 rooms from your PC to Atlas by running:
   ```bash
   python backend/migrate_to_atlas.py "<YOUR_ATLAS_CONNECTION_STRING>"
   ```
   *All records, students, passwords, and rooms will be uploaded safely in seconds!*

---

### STEP 3: Deploy Backend API on Render (Free)
1. Go to [https://render.com](https://render.com) and click **New +** > **Web Service**.
2. Connect your GitHub repository `hostel-management`.
3. Configure the service:
   - **Name:** `hostel-api`
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   - `ENVIRONMENT` = `production`
   - `MONGODB_URI` = `<Your MongoDB Atlas Connection String>`
   - `DATABASE_NAME` = `smart_hostel`
   - `JWT_SECRET` = `smart_hostel_super_secure_jwt_secret_key_2026_production_grade`
   - `CORS_ORIGINS` = `["https://veerashaivahostel.run.place", "https://*.vercel.app"]`
5. Click **Create Web Service**. Your backend will be live at `https://hostel-api.onrender.com`.

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
