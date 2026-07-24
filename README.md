# Pickleball Pulse (Free Hosted)

A lightweight web app for organizing pickleball events:
- Create event dates and venues
- Let players vote if they are available
- Update status to **Court Booked** once enough players commit
- View a dashboard summary of dates, signups, and venues

## 1) Create Free Supabase Backend

1. Sign up at Supabase (free tier).
2. Create a new project.
3. Open SQL Editor and run [supabase.sql](supabase.sql).
4. Go to Project Settings -> API and copy:
   - Project URL
   - anon public key

## 2) Configure Frontend

1. Open [config.js](config.js).
2. Fill in:
   - `supabaseUrl`
   - `supabaseAnonKey`

## 3) Run Locally

Option A: VS Code Live Server extension.
Option B: terminal

```powershell
cd c:\Users\E1418879\InternalAIAgents\pickleball-events-app
python -m http.server 5500
```

Open `http://localhost:5500`.

## 4) Deploy Free

### Netlify (free)

1. Push this folder to a GitHub repository.
2. Create a Netlify account.
3. Click "Add new site" -> "Import an existing project".
4. Choose your repo.
5. Build command: leave empty.
6. Publish directory: `.`
7. Deploy.

### Vercel (free)

1. Push this folder to a GitHub repository.
2. Import project in Vercel.
3. Framework preset: `Other`.
4. Build command: empty.
5. Output directory: empty.
6. Deploy.

## Notes

- Current setup allows public read/write for fast launch.
- If you want, next step is adding organizer login and private admin actions.
