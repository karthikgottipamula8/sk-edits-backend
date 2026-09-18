# SK Edits — Standalone Serverless Backend API (Vercel Ready)

Production-ready Node.js & Express REST API for **SK Edits**, architected for **Vercel Serverless Functions**, powered by **Supabase** (`cshiopegnhdldaupxjje`), JWT authentication, bcrypt encryption, and role-based access control (CLIENT, EDITOR, ADMIN).

---

## 🚀 Quick Deployment to Vercel (Independent Project)

### Step 1: Push Backend to a New GitHub Repository
This `backend` folder is an independent repository. Initialize and push it to GitHub:

```bash
# From within the backend directory:
git init
git add .
git commit -m "feat: SK Edits independent Vercel serverless backend"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/sk-edits-backend.git
git push -u origin main
```

---

### Step 2: Import as a New Project on Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** > **Project**.
2. Select your newly created `sk-edits-backend` GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: Select **Other** (do NOT select Vite, Next.js, or React).
   - **Root Directory**: `./` (leave as default root).
   - **Build Command**: Leave empty / disabled.
   - **Output Directory**: Leave empty / disabled.
   - **Install Command**: `npm install` (default).

---

### Step 3: Add Required Environment Variables in Vercel
In the Vercel project deployment screen (or under **Settings > Environment Variables**), add:

| Environment Variable | Description |
| :--- | :--- |
| `FRONTEND_URL` | Your frontend Vercel domain (e.g. `https://sk-edits.vercel.app`) |
| `SUPABASE_URL` | Your Supabase project URL (from Supabase Dashboard > Settings > API) |
| `SUPABASE_ANON_KEY` | Your Supabase anon public API key |
| `JWT_SECRET` | Secret key used to sign and verify session tokens |
| `NODE_ENV` | `production` |

---

### Step 4: Deploy & Connect to Frontend
1. Click **Deploy**. Vercel will deploy the serverless backend function in seconds.
2. Vercel will assign a public URL (e.g. `https://sk-edits-backend.vercel.app`).
3. In your **separate frontend Vercel project**:
   - Go to **Settings > Environment Variables**.
   - Set:
     ```env
     VITE_API_URL=https://sk-edits-backend.vercel.app
     ```
   - Redeploy the frontend so it picks up the new backend domain.

---

## 🛠 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
# Fill in your Supabase credentials and JWT secret in .env

# 3. Start local development server
npm run dev

# 4. Server runs at:
http://localhost:5000
```

---

## 📡 API Endpoints

- `GET /` — Health check: `{ "success": true, "message": "SK Edits backend is running" }`
- `GET /api/health` — Health check: `{ "success": true, "message": "SK Edits backend is running" }`
- `POST /api/auth/login` — Role-based user authentication (CLIENT, EDITOR, ADMIN)
- `POST /api/auth/register` — Client and Editor account creation
- `GET /api/auth/me` — Current authenticated user profile
- `GET /api/users` — Directory of users (Role filtered)
- `POST /api/users` — Create user (Admin only)
- `PATCH /api/users/profile` — Update email, mobile number, and password
- `GET /api/projects` — Role-scoped project tracking & Google Drive links
- `POST /api/projects` — Create new video project
- `GET /api/chat/conversations` — Conversation channels
- `POST /api/chat/conversations/:id/messages` — Send message with privacy filter
- `GET /api/payments/settings` — Gateway config (Razorpay, PhonePe, UPI)
- `GET /api/analytics/dashboard` — Platform analytics & metrics (Admin only)
