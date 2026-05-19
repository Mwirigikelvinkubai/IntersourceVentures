# Intersource Ventures Limited — Storefront

A Node.js + Express storefront for **Intersource Ventures Limited**, a Kenyan
importer and distributor of wellness products and baby essentials. Customers
browse the catalogue, add items to a cart, and place their order via WhatsApp.
An admin dashboard lets the team manage products, categories, badges, and the
hero featured product without touching code.

---

## Contents

```
intersource-server/
├── server.js               ← Express backend (admin + product/site CRUD)
├── .env                    ← Local environment variables (NEVER commit)
├── .gitignore              ← Excludes .env, node_modules, data/
├── package.json            ← Node dependencies
├── Procfile                ← For Heroku-style hosts
├── render.yaml             ← Render Blueprint (alternative host)
├── README.md               ← This file
├── DEPLOY_CPANEL.md        ← Step-by-step cPanel guide
├── data/                   ← Auto-created on first run
│   ├── products.json       ← Product catalogue
│   └── site.json           ← Categories, badges, hero featured
└── public/
    ├── index.html          ← Storefront (Bootstrap 5)
    ├── admin.html          ← Admin dashboard at /admin
    ├── img/                ← Logo, favicons
    ├── css/styles.css
    └── js/
        ├── app.js          ← Storefront logic
        └── admin.js        ← Admin dashboard logic
```

---

## Features

- Public storefront with category filters, search, and product cards.
- Cart with quantity controls (persisted in `localStorage`).
- **WhatsApp checkout** — the order summary is built client-side and opened in
  WhatsApp pre-filled to `+254 710 658 549`. No online payment processing.
- Admin dashboard at `/admin` for managing:
  - Products (create / edit / delete, with image upload as base64 or URL)
  - Categories (label, slug, Bootstrap Icon)
  - Badges (NEW / SALE / HOT, custom labels with hex colour)
  - Hero featured product (image, tag, name, price)
- Simple password protection for `/api/admin/*` routes via the
  `x-admin-password` header.
- Floating WhatsApp button on every page.

---

## Local development

### 1. Install Node.js

Install the **LTS** version from <https://nodejs.org>. Verify with:

```bash
node -v
npm -v
```

### 2. Install dependencies

```bash
cd intersource-server
npm install
```

### 3. Configure `.env`

The only required variable is the admin password:

```env
PORT=3000
ADMIN_PASSWORD=intersource2025
```

⚠ **Change `ADMIN_PASSWORD`** before deploying to production.

### 4. Run the server

```bash
npm run dev      # auto-restarts on file changes (nodemon)
# or
npm start        # plain node
```

The console will show:

```
╔══════════════════════════════════════════════╗
║   Intersource Ventures – Server started      ║
╠══════════════════════════════════════════════╣
║  URL   : http://localhost:3000               ║
║  Admin : http://localhost:3000/admin         ║
╚══════════════════════════════════════════════╝
```

Open <http://localhost:3000> for the storefront and
<http://localhost:3000/admin> for the dashboard.

### 5. Health check

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"2026-..."}
```

---

## Deploying to HostPinnacle (cPanel + Node.js)

HostPinnacle is the recommended Kenyan host for this project. Their shared and
business plans include **Setup Node.js App** (powered by Phusion Passenger) in
cPanel, which is everything you need to run `server.js` behind your domain.

This is the canonical deployment path — every step below has been verified
against the standard HostPinnacle cPanel layout.

### Prerequisites

1. An active HostPinnacle hosting plan that includes Node.js support. Look for
   one of these icons under cPanel → **Software**:
   - "Setup Node.js App"
   - "Node.js Selector"
   - "Application Manager"

   If you don't see any of them, open a support ticket with HostPinnacle and
   ask: *"Please enable Node.js apps via Passenger / Application Manager for
   my plan."* Most plans have it on by default; if yours doesn't, they enable
   it in minutes.
2. Your domain (e.g. `intersourceventureslimited.co.ke`) pointing at the
   HostPinnacle nameservers, or an addon / subdomain configured in cPanel.
3. The project zipped on your computer (exclude `node_modules/` and `.env`).

### Step 1 — Upload the project

You need the **whole** project on the server, not just `public/`. Apache
will hand requests off to the Node app, which serves the static frontend
from `public/` itself.

**Option A — File Manager (easiest)**

1. cPanel → **File Manager**
2. Navigate to your home directory (the one *containing* `public_html`, not
   `public_html` itself).
3. Click **Upload**, pick the zip you created, and wait for it to finish.
4. Right-click the zip → **Extract**. You should end up with
   `~/intersource-server/` containing `server.js`, `package.json`, `public/`,
   `data/`, etc.

**Option B — Git Version Control**

1. cPanel → **Git Version Control** → **Create**.
2. Clone URL: the HTTPS URL of your private GitHub repo.
3. Repository Path: `/home/<YOUR_CPANEL_USER>/intersource-server`.
4. Click **Create**. cPanel pulls the latest commit on demand; click
   "Manage" → "Pull or Deploy" → "Update from Remote" any time you push
   new code.

### Step 2 — Clear `public_html`

If you previously uploaded the static `public/` files into `public_html`,
delete or move them. Passenger will inject its own `.htaccess` that routes
all requests to the Node app.

1. cPanel → **File Manager** → `public_html/`.
2. Select everything → **Move** to a backup folder (or delete if you're sure).
3. Leave `public_html` empty. Step 3 below will populate `.htaccess`
   automatically.

### Step 3 — Create the Node.js application

1. cPanel → **Setup Node.js App** → **CREATE APPLICATION**.
2. Fill in:

   | Field | Value |
   |-------|-------|
   | **Node.js version** | the highest available (18.x or 20.x) |
   | **Application mode** | `Production` |
   | **Application root** | `intersource-server` (resolves to `/home/USER/intersource-server`) |
   | **Application URL** | your domain — leave the trailing path blank to serve from `/` |
   | **Application startup file** | `server.js` |
   | **Passenger log file** | `intersource-server/passenger.log` (optional but very useful) |

3. Click **CREATE**. cPanel writes a `.htaccess` into `public_html/`
   containing `PassengerAppRoot`, `PassengerAppType`, `PassengerStartupFile`,
   and `PassengerNodejs` directives.

### Step 4 — Set environment variables

Still on the **Setup Node.js App** page, click **Edit** next to your new app.
Scroll to **Environment variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | enables Express production optimizations |
| `ADMIN_PASSWORD` | a long, random string | this is your `/admin` login password |

⚠ On HostPinnacle (and any cPanel host using Passenger), these env vars
**replace** the `.env` file at runtime. Don't worry about uploading `.env`
— Passenger injects the values from the cPanel UI directly.

Click **SAVE** after adding each variable.

### Step 5 — Install dependencies and start

On the same app card in **Setup Node.js App**:

1. Click **Run NPM Install**. Wait ~30 seconds for it to finish. You should
   see "NPM Install completed" in the popup.
2. Click **RESTART APP**.

### Step 6 — Verify

Open these URLs in your browser:

- ✅ `https://yourdomain.co.ke/` → storefront renders.
- ✅ `https://yourdomain.co.ke/api/health` → returns
  `{"status":"ok","timestamp":"…"}`.
- ✅ `https://yourdomain.co.ke/api/products` → returns the product JSON.
- ✅ `https://yourdomain.co.ke/admin` → admin login screen. Log in with the
  `ADMIN_PASSWORD` you set in Step 4.

### Step 7 — Make the data folder persistent

HostPinnacle gives you a real disk (unlike Render's free tier), so
`data/products.json` and `data/site.json` survive redeploys automatically.
Just make sure your `intersource-server/data/` folder is writable:

```bash
# In cPanel → Terminal (or via SSH)
cd ~/intersource-server
mkdir -p data
chmod 755 data
```

If the admin dashboard saves but the data resets after a restart, run
`chown -R $USER:$USER data` to fix ownership.

### Updating the site later

When you push a code change:

1. Re-upload the changed files (File Manager) or `git pull` from cPanel's
   **Git Version Control** → "Update from Remote".
2. If you added dependencies, click **Run NPM Install** again.