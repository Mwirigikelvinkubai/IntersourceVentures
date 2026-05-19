# Deploying Intersource Ventures to cPanel (Kenyan host)

You uploaded the static files but the **Node.js backend isn't running**, which is
why `/admin` 404s and the password fails. Follow this guide once and everything
dynamic (admin login, product editing, M-Pesa STK push) will work.

---

## Step 1 — Confirm your host supports Node.js

Log into cPanel and look under the **Software** section for one of:

- 🟢 "Setup Node.js App"
- 🟢 "Node.js Selector"
- 🟢 "Application Manager"

If you see any of these — you're good. **Truehost, HostPinnacle, Kenya Web
Experts, Safaricom Cloud, and Hostraha all include this on most plans.**

If you don't see it, contact your host's support and ask:
> "Does my plan include Node.js apps via Passenger / Application Manager?"

If the answer is no, skip to **Step 7 (Alternative: Render deployment)**.

---

## Step 2 — Upload the whole project (not just public/)

You probably uploaded only `public/` to `public_html/`. We need the whole project.

### Option A — File Manager (easiest)

1. Zip the entire `intersource-server` folder on your computer
   (exclude `node_modules/` to keep the zip small)
2. cPanel → **File Manager** → go to your home directory (one level above `public_html`)
3. Upload the zip and **Extract** it
4. You should now have `~/intersource-server/` with `server.js`, `package.json`, `public/`, etc.

### Option B — Git (cleaner if you have it on GitHub)

1. cPanel → **Git Version Control** → "Create"
2. Clone URL: your GitHub repo
3. Repository Path: `/home/USER/intersource-server`
4. Click Create

---

## Step 3 — Clear the static deployment from public_html

Apache is currently serving files directly from `public_html`. Once Node takes
over, it'll serve the storefront from `public/` inside the project. So:

1. cPanel → **File Manager** → `public_html/`
2. Delete (or move to a backup folder) everything you previously uploaded
3. Leave `public_html` empty for now — cPanel will add an `.htaccess` in Step 4
   that proxies requests to your Node app.

---

## Step 4 — Create the Node.js application

1. cPanel → **Setup Node.js App** → **CREATE APPLICATION**
2. Fill in:
   - **Node.js version:** 18.x or 20.x (highest available)
   - **Application mode:** Production
   - **Application root:** `intersource-server`
     (this should auto-resolve to `/home/USER/intersource-server`)
   - **Application URL:** select your domain `intersourceventureslimited.co.ke`
     (leave the trailing path blank — we want the app to serve the root)
   - **Application startup file:** `server.js`
3. Click **CREATE**.

cPanel will create an `.htaccess` in your `public_html/` that proxies all
requests to the Node app via Phusion Passenger.

---

## Step 5 — Set environment variables (THIS IS WHERE THE PASSWORD GOES)

Still on the Setup Node.js App page, find your new app and click **Edit**.
Scroll down to **Environment variables** and click **ADD VARIABLE** for each:

| Variable | Value |
|----------|-------|
| `MPESA_ENV` | `production` (or `sandbox` for testing) |
| `CONSUMER_KEY` | your Daraja Consumer Key |
| `CONSUMER_SECRET` | your Daraja Consumer Secret |
| `SHORTCODE` | `400200` |
| `PASSKEY` | your live Daraja Passkey |
| `ACCOUNT_REF` | `37996` |
| `TRANSACTION_DESC` | `Intersource Ventures Order` |
| `CALLBACK_URL` | `https://intersourceventureslimited.co.ke/api/mpesa/callback` |
| `ADMIN_PASSWORD` | **your strong admin password** ← THIS IS YOUR LOGIN |

⚠ **Important:** these env vars REPLACE the `.env` file on cPanel hosts.
The `.env` file isn't read in this setup — cPanel injects these directly.
Don't worry about uploading `.env`.

Click **SAVE**.

---

## Step 6 — Install dependencies and start

On the same Setup Node.js App page for your app:

1. Click **Run NPM Install** — wait for it to finish (≈ 30 seconds)
2. Click **RESTART APP**

Now visit:

- ✅ https://intersourceventureslimited.co.ke/ → storefront loads
- ✅ https://intersourceventureslimited.co.ke/api/health → returns `{"status":"ok",...}`
- ✅ https://intersourceventureslimited.co.ke/admin → admin login page
- ✅ Log in with the `ADMIN_PASSWORD` you set in Step 5

If `/api/health` still returns 404, check the **stderr.log** in your app's
folder (Setup Node.js App → "Run JS Script" → "stderr.log") for errors.

---

## Step 7 — Alternative: deploy to Render (free, easier)

If your cPanel host doesn't support Node.js, deploy to Render instead and point
your domain at it:

1. Push your project to GitHub (private repo is fine)
2. Sign up at https://render.com → "New +" → "Blueprint"
3. Connect your repo. Render reads `render.yaml` automatically.
4. Set the env vars in the Render dashboard (mark secrets as Secret):
   `CONSUMER_KEY`, `CONSUMER_SECRET`, `SHORTCODE`, `PASSKEY`, `CALLBACK_URL`,
   `ADMIN_PASSWORD`
5. Click **Apply** — Render gives you a URL like
   `intersource-ventures.onrender.com`
6. **Point your domain at Render:**
   - In your domain registrar (or cPanel → Zone Editor)
   - Add a CNAME for `www` → `intersource-ventures.onrender.com`
   - For the apex (`intersourceventureslimited.co.ke`) add Render's ALIAS / A records (Render shows them in the dashboard)
7. In Render → your service → Settings → Custom Domain → add `intersourceventureslimited.co.ke`. Render auto-provisions a Let's Encrypt SSL cert.

---

## Troubleshooting checklist

**Site doesn't load at all after deployment:**
- File Manager → `public_html/.htaccess` exists and contains `PassengerAppRoot` lines? If not, recreate the app.

**`/admin` still 404s:**
- Check that `server.js` is the startup file in the cPanel app config
- Look at stderr.log for a startup error (most often a missing dependency — re-run NPM Install)

**Password rejected even after setting `ADMIN_PASSWORD`:**
- Make sure you clicked SAVE after adding the variable, and then RESTARTED the app
- Try logging out (clear sessionStorage) — open browser DevTools → Application → Session Storage → delete `intersource_admin_pw`
- The default fallback is `intersource2025` if no env var is set — try that

**M-Pesa STK push fails:**
- `CALLBACK_URL` must be your live HTTPS URL — no ngrok, no http
- `MPESA_ENV` must match your credentials (sandbox creds with production env = silent fail)

---

## Why this happened

You uploaded `public/` to `public_html/`, so Apache served the HTML directly.
That works for the look of the site but every dynamic feature (login,
product CRUD, M-Pesa) requires Express on Node to be running and routing
those requests. Now that we've added the Node app via Passenger, requests
flow:

```
Browser → Apache (intersourceventureslimited.co.ke) → Passenger → Node (server.js) → Express
                                                                                       ↓
                                                                        Serves /public statically
                                                                        Handles /api/* dynamically
                                                                        Handles /admin route
```
