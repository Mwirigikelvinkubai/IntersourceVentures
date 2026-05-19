# Deploying Intersource Ventures to cPanel (HostPinnacle / Kenyan host)

If you uploaded the static files but `/admin` returns 404, that means the
**Node.js backend isn't running**. The storefront HTML loads via Apache, but
every dynamic feature (admin login, product editing, the API) needs Express
on Node behind it. Follow this guide once and everything works.

The same steps apply to any cPanel host that exposes **Setup Node.js App** /
**Application Manager** — HostPinnacle, Truehost, Kenya Web Experts, Safaricom
Cloud, Hostraha, etc.

---

## Step 1 — Confirm your host supports Node.js

Log into cPanel and look under the **Software** section for one of:

- "Setup Node.js App"
- "Node.js Selector"
- "Application Manager"

If you see any of these — you're good. If you don't, open a support ticket
and ask:

> "Does my plan include Node.js apps via Passenger / Application Manager?
> Please enable it on my account."

If the answer is no, skip to **Step 7 (alternative: Render deployment)**.

---

## Step 2 — Upload the whole project (not just `public/`)

A common mistake is uploading only `public/` to `public_html/`. We need the
whole project on the server so Node can run it.

### Option A — File Manager

1. Zip the entire `intersource-server` folder on your computer
   (exclude `node_modules/` to keep the zip small).
2. cPanel → **File Manager** → go to your home directory
   (one level above `public_html`).
3. Upload the zip and **Extract** it.
4. You should now have `~/intersource-server/` with `server.js`,
   `package.json`, `public/`, etc.

### Option B — Git Version Control

1. cPanel → **Git Version Control** → **Create**.
2. Clone URL: your GitHub repo (private is fine — paste a token-bearing URL
   if needed).
3. Repository Path: `/home/USER/intersource-server`.
4. Click **Create**.

---

## Step 3 — Clear the static deployment from `public_html`

Apache is currently serving files directly from `public_html`. Once Node
takes over, it'll serve the storefront from `public/` *inside the project*. So:

1. cPanel → **File Manager** → `public_html/`.
2. Delete (or move to a backup folder) everything you previously uploaded.
3. Leave `public_html` empty for now — cPanel will add an `.htaccess` in
   Step 4 that proxies requests to your Node app.

---

## Step 4 — Create the Node.js application

1. cPanel → **Setup Node.js App** → **CREATE APPLICATION**.
2. Fill in:
   - **Node.js version:** 18.x or 20.x (highest available)
   - **Application mode:** Production
   - **Application root:** `intersource-server`
     (this resolves to `/home/USER/intersource-server`)
   - **Application URL:** select your domain
     (leave the trailing path blank — we want the app to serve the root)
   - **Application startup file:** `server.js`
3. Click **CREATE**.

cPanel will create an `.htaccess` in your `public_html/` that proxies all
requests to the Node app via Phusion Passenger.

---

## Step 5 — Set environment variables

Still on the **Setup Node.js App** page, click **Edit** next to your new app.
Scroll to **Environment variables** and click **ADD VARIABLE** for each:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `ADMIN_PASSWORD` | **your strong admin password** ← this is your `/admin` login |

⚠ **Important:** these env vars REPLACE the `.env` file on cPanel hosts.
The `.env` file isn't read in this setup — cPanel injects the values
directly into the process. Don't worry about uploading `.env`.

Click **SAVE** after each one.

---

## Step 6 — Install dependencies and start

On the same Setup Node.js App page for your app:

1. Click **Run NPM Install** — wait for it to finish (≈ 30 seconds).
2. Click **RESTART APP**.

Now visit:

- ✅ `https://yourdomain.co.ke/` → storefront loads.
- ✅ `https://yourdomain.co.ke/api/health` → returns `{"status":"ok",...}`.
- ✅ `https://yourdomain.co.ke/admin` → admin login page.
- ✅ Log in with the `ADMIN_PASSWORD` you set in Step 5.

If `/api/health` still returns 404, check `stderr.log` or `passenger.log` in
your app's folder (cPanel → **File Manager** → `intersource-server/`) for
the actual startup error.

---

## Step 7 — Alternative: deploy to Render (free, easier)

If your cPanel host doesn't support Node.js, deploy to Render instead and
point your domain at it:

1. Push your project to GitHub (private repo is fine).
2. Sign up at <https://render.com> → "New +" → "Blueprint".
3. Connect your repo. Render reads `render.yaml` automatically.
4. Set `ADMIN_PASSWORD` as a Secret in the Render dashboard.
5. Click **Apply** — Render gives you a URL like
   `intersource-ventures.onrender.com`.
6. **Point your domain at Render:**
   - In your domain registrar (or cPanel → Zone Editor):
   - Add a CNAME for `www` → `intersource-ventures.onrender.com`.
   - For the apex (`intersourceventureslimited.co.ke`) add Render's ALIAS /
     A records (Render shows them in the dashboard).
7. In Render → your service → Settings → Custom Domain → add your domain.
   Render auto-provisions a Let's Encrypt SSL cert.

---

## Troubleshooting checklist

**Site doesn't load at all after deployment**

- File Manager → `public_html/.htaccess` exists and contains `PassengerAppRoot`
  lines? If not, recreate the app in Setup Node.js App.

**`/admin` still 404s**

- Check that `server.js` is the startup file in the cPanel app config.
- Look at `stderr.log` or `passenger.log` for a startup error (most often a
  missing dependency — re-run **Run NPM Install**).

**Password rejected even after setting `ADMIN_PASSWORD`**

- Make sure you clicked **SAVE** after adding the variable, and then
  **RESTART APP**.
- Try logging out: open browser DevTools → Application → Session Storage →
  delete `intersource_admin_pw`, then reload.
- The default fallback is `intersource2025` if no env var is set — useful for
  verifying the wiring, but never leave it that way in production.

**Data resets after every restart**

The `data/` folder isn't writable. From cPanel → **Terminal**:

```bash
cd ~/intersource-server
chmod 755 data
chmod 644 data/*.json
```

---

## Why this matters

If you upload only `public/` to `public_html/`, Apache serves the HTML
directly. The site looks fine, but every dynamic feature (login, product
CRUD, the API) needs Express on Node running and routing those requests.
Once the Node app is registered with Passenger via **Setup Node.js App**,
the request flow becomes:

```
Browser → Apache (yourdomain.co.ke) → Passenger → Node (server.js) → Express
                                                                         ↓
                                                          Serves /public statically
                                                          Handles /api/* dynamically
                                                          Handles /admin route
```
