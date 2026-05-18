# Intersource Ventures – M-Pesa Daraja Setup Guide

## What you have

```
intersource-server/
├── server.js               ← Express backend (Daraja + product/site CRUD)
├── .env                    ← Your credentials (NEVER share / commit this)
├── .gitignore              ← Excludes .env, node_modules, data/
├── package.json            ← Node.js dependencies
├── Procfile                ← For Heroku-style hosts
├── render.yaml             ← Render Blueprint
├── README.md               ← This file
├── data/                   ← Auto-created on first run
│   ├── products.json       ← Product catalogue
│   └── site.json           ← Categories, badges, hero featured product
└── public/
    ├── index.html          ← Storefront (Bootstrap 5)
    ├── admin.html          ← Admin dashboard (served at /admin)
    ├── img/                ← Logo, favicons, app icons
    ├── css/styles.css
    └── js/
        ├── app.js          ← Storefront logic
        └── admin.js        ← Admin dashboard logic
```

## Admin panel

A password-protected admin dashboard lives at **http://localhost:3000/admin**
(also linked discreetly in the footer of the storefront).

The dashboard has four tabs:

- **Products** — add, edit, upload images (or paste URLs), delete
- **Categories** — manage the category filter pills on the storefront (label, slug, Bootstrap Icon)
- **Badges** — manage the colored badges (NEW, SALE, HOT, or any custom badge with custom hex color)
- **Hero Featured** — change the floating product card next to the hero headline

The default admin password is set in `.env`:
```
ADMIN_PASSWORD=intersource2025
```
⚠ **Change this** before going live. The password is sent as the
`x-admin-password` header to all `/api/admin/*` routes.

## WhatsApp button

A floating green WhatsApp icon (bottom-left) opens a chat with
`+254 710 658 549` pre-filled with a friendly product inquiry.

---

## 🚀 Deploying to production

### Option A — Render (recommended, simplest)

1. Push this folder to a private GitHub repo.
2. Sign in at **https://render.com** and click "New +" → "Blueprint".
3. Connect your repo. Render reads `render.yaml` automatically.
4. In the env-var section, set these as **Secret**:
   - `CONSUMER_KEY`, `CONSUMER_SECRET` (from your Daraja app)
   - `SHORTCODE`, `PASSKEY` (from your live Lipa na M-Pesa)
   - `CALLBACK_URL` — set to `https://YOUR-RENDER-URL.onrender.com/api/mpesa/callback`
     after the first deploy (you'll need to redeploy to apply it)
   - `ADMIN_PASSWORD` — pick a strong password
5. Click **Apply**. Render builds, deploys, and gives you a public HTTPS URL.

⚠ **Free plan caveat:** Render's free tier wipes the filesystem on redeploy,
so `data/products.json` resets to defaults each time. To keep your catalog,
upgrade to the **Starter plan** (≈ $7/mo); the `render.yaml` already declares
a 1 GB persistent disk.

### Option B — Railway

1. Push to GitHub.
2. At **https://railway.app** → "New Project" → "Deploy from GitHub repo".
3. Add all `.env` keys via the Railway dashboard.
4. Railway provides a domain like `intersource.up.railway.app`.

### Option C — DigitalOcean / your own VPS

```bash
# On your server
git clone YOUR_REPO
cd intersource-server
npm install --production
# Create /etc/intersource.env with your environment variables
# Use pm2 or systemd to keep the process running
npm install -g pm2
pm2 start server.js --name intersource
pm2 save
```
Put it behind nginx with a Let's Encrypt cert. Update your Daraja
`CALLBACK_URL` to point at your real domain.

### Daraja go-live checklist

- [ ] `MPESA_ENV=production`
- [ ] Live `CONSUMER_KEY` and `CONSUMER_SECRET`
- [ ] Live `SHORTCODE` (400200) and `PASSKEY` (from Daraja portal)
- [ ] `CALLBACK_URL` points to your real HTTPS domain — no ngrok
- [ ] `ADMIN_PASSWORD` changed from the default
- [ ] `.env` is **NOT** in git (verify with `git status`)

---

---

## PART 1 – Install & run locally (sandbox testing)

### Step 1 – Install Node.js
If you don't have Node.js installed:
1. Go to https://nodejs.org
2. Download and install the **LTS** version
3. Verify: open Terminal and run `node -v` — you should see a version number

### Step 2 – Install dependencies
Open Terminal, navigate to this folder, and run:
```bash
cd intersource-server
npm install
```

### Step 3 – Install ngrok (so Safaricom can reach your localhost)
Safaricom's servers need to send payment confirmations to your computer.
ngrok creates a public tunnel to your localhost.

1. Go to https://ngrok.com and create a free account
2. Download ngrok for your OS
3. Copy your authtoken from the ngrok dashboard
4. Run: `ngrok config add-authtoken YOUR_TOKEN_HERE`

### Step 4 – Start ngrok tunnel
In a **new Terminal window** (keep it open):
```bash
ngrok http 3000
```
You will see output like:
```
Forwarding   https://abc123.ngrok-free.app → http://localhost:3000
```
Copy that `https://abc123.ngrok-free.app` URL.

### Step 5 – Update your .env with the ngrok URL
Open `.env` and update this line:
```
CALLBACK_URL=https://abc123.ngrok-free.app/api/mpesa/callback
```
Replace `abc123.ngrok-free.app` with your actual ngrok URL.
⚠️  ngrok gives you a new URL every time you restart it. Update .env each time.

### Step 6 – Start the server
```bash
npm run dev
```
You should see:
```
╔══════════════════════════════════════════════╗
║   Intersource Ventures – Server started      ║
╠══════════════════════════════════════════════╣
║  URL   : http://localhost:3000               ║
║  Mode  : sandbox                             ║
║  Paybill: 174379                             ║
╚══════════════════════════════════════════════╝
```

### Step 7 – Open the website
Go to: http://localhost:3000

---

## PART 2 – Testing with sandbox

### Test phone numbers (use these, NOT real numbers)
The Safaricom sandbox has test numbers you can use:
- **254708374149** (will succeed)
- **254700000000** (will fail — for testing error flow)

### How to test the full flow:
1. Add products to cart
2. Click "Pay with M-Pesa"
3. Enter: `0708374149`
4. Click "Send payment prompt"
5. Watch the server Terminal — you will see the callback arrive
6. The website will show "Payment received!" automatically

### Check server health:
Open: http://localhost:3000/api/health

---

## PART 3 – Create your Daraja account & go LIVE

### Step 1 – Register on the Daraja portal
1. Go to https://developer.safaricom.co.ke
2. Click "Sign Up" and create an account
3. Verify your email

### Step 2 – Create an app
1. Log in → click "My Apps" → "Add New App"
2. Name it: "Intersource Ventures"
3. Tick: **Lipa Na M-Pesa** (this enables STK Push)
4. Click Create App

### Step 3 – Get your credentials
On your app page you will see:
- **Consumer Key** — copy this
- **Consumer Secret** — copy this

### Step 4 – Get your Live Passkey
1. On the portal, go to **My Apps** → your app → **Go Live**
2. Follow the steps (they may ask for business documents)
3. Once approved, go to **Lipa na M-Pesa** → your shortcode settings
4. You will find your **Passkey** there

### Step 5 – Update .env for production
```env
MPESA_ENV=production

CONSUMER_KEY=your_live_consumer_key
CONSUMER_SECRET=your_live_consumer_secret

SHORTCODE=400200
PASSKEY=your_live_passkey

CALLBACK_URL=https://your-live-domain.com/api/mpesa/callback
```

### Step 6 – Deploy to a live server
For production you need a server with a real domain (not ngrok).
Recommended options:
- **Railway** (railway.app) — free tier, simple deploy
- **Render** (render.com) — free tier, good for Node.js
- **DigitalOcean** — KES ~600/month, full control

---

## PART 4 – Production improvements (optional)

Replace the in-memory payment store with a real database:
```bash
npm install better-sqlite3
# or
npm install mongoose  # for MongoDB
```

Add order email notifications:
```bash
npm install nodemailer
```

---

## Quick reference

| What | Value |
|------|-------|
| Website | http://localhost:3000 |
| STK Push endpoint | POST http://localhost:3000/api/mpesa/stkpush |
| Callback endpoint | POST http://localhost:3000/api/mpesa/callback |
| Status polling | GET http://localhost:3000/api/mpesa/status/:id |
| Health check | GET http://localhost:3000/api/health |
| Sandbox Paybill | 174379 |
| Live Paybill | 400200 |
| Live Account | 37996 |
| Support | intersourceventureslimited@gmail.com |
| Phone | +254 710 658 549 |

---

## Need help?
Contact: intersourceventureslimited@gmail.com
Daraja docs: https://developer.safaricom.co.ke/docs
